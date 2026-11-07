import { NextRequest, NextResponse } from "next/server";
import { ensureEnglishTables, getWord, getWordCrawlData, upsertWordCrawlData } from "@/src/lib/english-db";
import { getUserId, unauthorized } from "@/src/lib/auth";

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

// dictionaryapi.dev sits behind Cloudflare, which appears to flag Vercel's
// serverless IPs outright regardless of User-Agent/retries (confirmed broken
// in production after two earlier attempts at headers/backoff) — it mostly
// comes back with zero phonetics even when the rest of the entry succeeds.
// As a fallback for just the phonetic, look the word up in the open IPA
// dataset served from raw.githubusercontent.com, a host that isn't behind
// that same bot-protection. The ~3MB word->IPA file is cached in module
// scope so it's only downloaded once per warm serverless instance.
let ipaDictPromise: Promise<Map<string, string>> | null = null;

async function getIpaDict(): Promise<Map<string, string>> {
  if (!ipaDictPromise) {
    ipaDictPromise = (async () => {
      const map = new Map<string, string>();
      try {
        const res = await fetch("https://raw.githubusercontent.com/open-dict-data/ipa-dict/master/data/en_US.txt", {
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return map;
        const text = await res.text();
        for (const line of text.split("\n")) {
          const tab = line.indexOf("\t");
          if (tab === -1) continue;
          const word = line.slice(0, tab).trim().toLowerCase();
          const first = line.slice(tab + 1).split(",")[0]?.trim().replace(/^\/|\/$/g, "");
          if (word && first && !map.has(word)) map.set(word, first);
        }
      } catch (e) {
        console.error("[dictionary crawl] ipa-dict fetch failed", e);
      }
      return map;
    })();
  }
  return ipaDictPromise;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

interface WiktionaryDefinition {
  definition?: string;
  examples?: string[];
}

interface WiktionaryEntry {
  partOfSpeech?: string;
  definitions?: WiktionaryDefinition[];
}

// dictionaryapi.dev is itself sourced from Wiktionary, but goes through its
// own Cloudflare-fronted mirror that sometimes answers Vercel's serverless
// IPs with an entry that has a part of speech but zero definitions (seen in
// production, confirmed reproducible for specific words like "resent" —
// not a transient blip). Wiktionary's own REST API is a different host with
// no such bot-protection, so it's used as a fallback for full definitions
// (not just a part-of-speech guess, unlike the datamuse fallback below).
async function fetchWiktionaryFallback(word: string): Promise<EntrySenseBlock[]> {
  try {
    const res = await fetch(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "personal-blog-english-study/1.0" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as Record<string, WiktionaryEntry[]>;
    const entries = data.en ?? [];
    const senses: EntrySenseBlock[] = [];
    for (const entry of entries) {
      const definitions = (entry.definitions ?? [])
        .map((d) => ({
          text: stripHtml(d.definition ?? ""),
          examples: (d.examples ?? []).map(stripHtml).filter(Boolean).slice(0, 1),
        }))
        .filter((d) => d.text)
        .slice(0, 10);
      if (definitions.length > 0) {
        senses.push({ partOfSpeech: entry.partOfSpeech?.toLowerCase(), definitions });
      }
    }
    return senses;
  } catch (e) {
    console.error("[dictionary crawl] wiktionary fallback failed", e);
    return [];
  }
}

const DATAMUSE_POS: Record<string, string> = { n: "noun", v: "verb", adj: "adjective", adv: "adverb" };

async function fetchFallbackSenses(word: string): Promise<EntrySenseBlock[]> {
  try {
    const res = await fetch(`https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=p&max=1`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { word?: string; tags?: string[] }[];
    const hit = data.find((d) => d.word?.toLowerCase() === word);
    return (hit?.tags ?? [])
      .map((t) => DATAMUSE_POS[t])
      .filter(Boolean)
      .map((partOfSpeech) => ({ partOfSpeech, definitions: [] }));
  } catch (e) {
    console.error("[dictionary crawl] datamuse fetch failed", e);
    return [];
  }
}

async function fetchRaw(apiUrl: string): Promise<ApiEntry[] | null> {
  const res = await fetch(apiUrl, {
    signal: AbortSignal.timeout(8000),
    // dictionaryapi.dev sits behind Cloudflare, which is more likely to rate-
    // limit or challenge requests from datacenter IPs (Vercel's serverless
    // functions) when they look like bare bot traffic. A normal browser-style
    // User-Agent/Accept pair measurably reduces that.
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "application/json",
    },
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`dictionaryapi.dev request failed: ${res.status}`);
  const text = await res.text();
  if (!text.trim()) return null;
  return JSON.parse(text) as ApiEntry[];
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
  let entries: ApiEntry[] | null = null;
  try {
    entries = await fetchRaw(apiUrl);
  } catch {
    // keep retrying / fall through to the retry loop below
  }
  for (let attempt = 0; (!entries || entries.length === 0) && trimmed && attempt < 3; attempt++) {
    await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    try {
      const retry = await fetchRaw(apiUrl);
      if (retry && retry.length > 0) entries = retry;
    } catch {
      // keep retrying / fall through to the empty result below
    }
  }
  if (!entries || entries.length === 0) {
    const result = emptyResult(word, apiUrl);
    const fallbackIpa = (await getIpaDict()).get(trimmed);
    if (fallbackIpa) result.pronunciations.push({ ipa: fallbackIpa });
    result.senses = await fetchWiktionaryFallback(trimmed);
    if (result.senses.length === 0) result.senses = await fetchFallbackSenses(trimmed);
    return result;
  }

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

  if (pronunciations.length === 0) {
    const fallbackIpa = (await getIpaDict()).get(trimmed);
    if (fallbackIpa) pronunciations.push({ ipa: fallbackIpa });
  }
  if (senses.length === 0) {
    senses.push(...(await fetchWiktionaryFallback(trimmed)));
    if (senses.length === 0) senses.push(...(await fetchFallbackSenses(trimmed)));
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
  return d.parserVersion === PARSER_VERSION && (d.senses ?? []).some((s) => s.definitions.length > 0);
}

export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
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
      const rec = await getWord(userId, wordId);
      if (!rec) return NextResponse.json({ error: "word not found" }, { status: 404 });
      word = rec.word;
      if (!force) {
        const cached = await getWordCrawlData(userId, wordId);
        if (hasUsefulData(cached)) {
          return NextResponse.json({ crawlData: cached, cached: true });
        }
      }
    }

    if (!word) {
      return NextResponse.json({ error: "missing word or wordId" }, { status: 400 });
    }

    const crawlData = await fetchDictionaryEntry(word);
    if (wordId && hasUsefulData(crawlData)) await upsertWordCrawlData(userId, wordId, crawlData);

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
