import { NextRequest, NextResponse } from "next/server";
import { ensureEnglishTables, getWord, getWordCrawlData, upsertWordCrawlData } from "@/src/lib/english-db";

// Full English-English dictionary entry for a single word, cached per-word in
// english_words.crawl_data (JSONB): a single on-demand fetch per word,
// triggered by user action, never bulk/automatic.
//
// NOTE: an earlier version of this route scraped dictionary.cambridge.org's
// HTML directly, but Cambridge blocks non-browser requests with a 403 almost
// immediately in practice, making that approach unusable in production. This
// uses the free, public https://dictionaryapi.dev instead (itself sourced
// from Wiktionary), which returns structured JSON with no bot-blocking.

const PARSER_VERSION = 2;

interface EntryPronunciation {
  region?: string;
  ipa?: string;
  audioUrl?: string;
}

interface EntrySenseBlock {
  partOfSpeech?: string;
  definitions: { text: string; examples: string[] }[];
}

interface DictionaryCrawlData {
  source: "dictionaryapi.dev";
  parserVersion: number;
  fetchedAt: string;
  url: string;
  word: string;
  pronunciations: EntryPronunciation[];
  senses: EntrySenseBlock[];
  synonyms: string[];
  antonyms: string[];
}

interface ApiPhonetic {
  text?: string;
  audio?: string;
}

interface ApiDefinition {
  definition?: string;
  example?: string;
  synonyms?: string[];
  antonyms?: string[];
}

interface ApiMeaning {
  partOfSpeech?: string;
  definitions?: ApiDefinition[];
  synonyms?: string[];
  antonyms?: string[];
}

interface ApiEntry {
  word?: string;
  phonetic?: string;
  phonetics?: ApiPhonetic[];
  meanings?: ApiMeaning[];
}

function emptyResult(word: string, apiUrl: string): DictionaryCrawlData {
  return {
    source: "dictionaryapi.dev",
    parserVersion: PARSER_VERSION,
    fetchedAt: new Date().toISOString(),
    url: apiUrl,
    word,
    pronunciations: [],
    senses: [],
    synonyms: [],
    antonyms: [],
  };
}

async function fetchRaw(apiUrl: string): Promise<ApiEntry[] | null> {
  const res = await fetch(apiUrl, { signal: AbortSignal.timeout(8000) });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`dictionaryapi.dev request failed: ${res.status}`);
  return (await res.json()) as ApiEntry[];
}

async function fetchDictionaryEntry(word: string): Promise<DictionaryCrawlData> {
  const trimmed = word.trim().toLowerCase();
  const apiUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(trimmed)}`;

  // The free dictionaryapi.dev service has real intermittent reliability
  // issues (it sometimes returns an empty/malformed body for a word that
  // does exist, with no distinguishing error). A couple of short-backoff
  // retries clear this up often enough to be worth it, but a genuine outage
  // on their end can still surface as "not found" here — that is a
  // third-party availability issue, not a bug in this app.
  let entries = await fetchRaw(apiUrl);
  for (let attempt = 0; (!entries || entries.length === 0) && trimmed && attempt < 2; attempt++) {
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    try {
      const retry = await fetchRaw(apiUrl);
      if (retry && retry.length > 0) entries = retry;
    } catch {
      // keep retrying / fall through to the empty result below
    }
  }
  if (!entries || entries.length === 0) return emptyResult(word, apiUrl);

  const pronunciations: EntryPronunciation[] = [];
  const senses: EntrySenseBlock[] = [];
  const synonyms = new Set<string>();
  const antonyms = new Set<string>();

  for (const entry of entries) {
    try {
      for (const p of entry.phonetics ?? []) {
        const ipa = p.text?.replace(/^\/|\/$/g, "");
        if (ipa || p.audio) pronunciations.push({ ipa, audioUrl: p.audio || undefined });
      }
    } catch (e) {
      console.error("[dictionary crawl] phonetics parse failed", e);
    }

    for (const meaning of entry.meanings ?? []) {
      try {
        const definitions = (meaning.definitions ?? [])
          .filter((d) => d.definition)
          .slice(0, 10)
          .map((d) => ({ text: d.definition!.trim(), examples: d.example ? [d.example.trim()] : [] }));
        if (definitions.length > 0) {
          senses.push({ partOfSpeech: meaning.partOfSpeech, definitions });
        }
        for (const s of meaning.synonyms ?? []) synonyms.add(s);
        for (const a of meaning.antonyms ?? []) antonyms.add(a);
        for (const d of meaning.definitions ?? []) {
          for (const s of d.synonyms ?? []) synonyms.add(s);
          for (const a of d.antonyms ?? []) antonyms.add(a);
        }
      } catch (e) {
        console.error("[dictionary crawl] meaning parse failed", e);
      }
    }
  }

  return {
    source: "dictionaryapi.dev",
    parserVersion: PARSER_VERSION,
    fetchedAt: new Date().toISOString(),
    url: `https://www.google.com/search?q=define+${encodeURIComponent(trimmed)}`,
    word,
    pronunciations: pronunciations.slice(0, 5),
    senses: senses.slice(0, 15),
    synonyms: [...synonyms].slice(0, 20),
    antonyms: [...antonyms].slice(0, 20),
  };
}

function hasUsefulData(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const d = data as Partial<DictionaryCrawlData>;
  return d.parserVersion === PARSER_VERSION && (d.senses?.length ?? 0) > 0;
}

export async function GET(req: NextRequest) {
  try {
    await ensureEnglishTables();
    const wordIdParam = req.nextUrl.searchParams.get("wordId");
    const wordParam = req.nextUrl.searchParams.get("word")?.trim();
    const force = req.nextUrl.searchParams.get("force") === "1";

    let wordId: number | undefined;
    let word = wordParam;

    if (wordIdParam) {
      wordId = parseInt(wordIdParam, 10);
      if (Number.isNaN(wordId)) {
        return NextResponse.json({ error: "invalid wordId" }, { status: 400 });
      }
      const rec = await getWord(wordId);
      if (!rec) return NextResponse.json({ error: "word not found" }, { status: 404 });
      word = rec.word;
      if (!force) {
        const cached = await getWordCrawlData(wordId);
        if (hasUsefulData(cached)) {
          return NextResponse.json({ crawlData: cached, cached: true });
        }
      }
    }

    if (!word) {
      return NextResponse.json({ error: "missing word or wordId" }, { status: 400 });
    }

    const crawlData = await fetchDictionaryEntry(word);
    if (wordId && hasUsefulData(crawlData)) await upsertWordCrawlData(wordId, crawlData);

    if (!hasUsefulData(crawlData)) {
      return NextResponse.json({ crawlData, error: "Không tìm thấy từ này trong từ điển." });
    }

    return NextResponse.json({ crawlData, cached: false });
  } catch (e) {
    console.error("[GET english/crawl error]", e);
    const message = e instanceof Error ? e.message : "unknown error";
    const timedOut = message.toLowerCase().includes("abort") || message.toLowerCase().includes("timeout");
    return NextResponse.json(
      { error: timedOut ? "Hết thời gian chờ từ điển. Thử lại sau." : "Không lấy được dữ liệu từ điển." },
      { status: 200 }
    );
  }
}
