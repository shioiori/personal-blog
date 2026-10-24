import { NextRequest, NextResponse } from "next/server";
import { ensureEnglishTables, getWord, getWordCrawlData, upsertWordCrawlData } from "@/src/lib/english-db";

// Best-effort live crawl of the Cambridge English-English dictionary entry for a
// single word, cached per-word in english_words.crawl_data (JSONB). Mirrors the
// chinese feature's crawl-data pattern (src/app/api/chinese/crawl-data/route.ts):
// a single on-demand fetch per word, triggered by user action, never bulk/automatic.
// Cambridge's HTML is unstable/undocumented, so every extraction step is wrapped
// in try/catch — a partial failure must never crash the whole request.

const PARSER_VERSION = 1;

interface CambridgeSenseBlock {
  partOfSpeech?: string;
  definitions: { text: string; examples: string[] }[];
}

interface CambridgePronunciation {
  region: "uk" | "us";
  ipa?: string;
  audioUrl?: string;
}

interface CambridgeCrawlData {
  source: "cambridge";
  parserVersion: number;
  fetchedAt: string;
  url: string;
  word: string;
  pronunciations: CambridgePronunciation[];
  senses: CambridgeSenseBlock[];
  synonyms: string[];
  raw?: string;
}

function decodeHtml(text: string) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(html: string) {
  return decodeHtml(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).trim();
}

function extractBlocks(html: string, className: string): string[] {
  // Naive balanced-div extractor scoped to elements carrying `className`.
  const blocks: string[] = [];
  const re = new RegExp(`<div[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>`, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const start = match.index;
    let depth = 0;
    let i = start;
    const tagRe = /<div\b[^>]*>|<\/div>/gi;
    tagRe.lastIndex = start;
    let end = html.length;
    let m: RegExpExecArray | null;
    while ((m = tagRe.exec(html))) {
      if (m[0].toLowerCase().startsWith("</div")) {
        depth--;
      } else {
        depth++;
      }
      if (depth === 0) {
        end = m.index + m[0].length;
        break;
      }
    }
    blocks.push(html.slice(start, end));
    re.lastIndex = end;
    i = end;
    void i;
  }
  return blocks;
}

function parsePronunciations(html: string): CambridgePronunciation[] {
  const results: CambridgePronunciation[] = [];
  try {
    for (const region of ["uk", "us"] as const) {
      const blockRe = new RegExp(`<span[^>]*class=["'][^"']*\\b${region}dpron-lbl\\b[^"']*["'][\\s\\S]*?<\\/span>\\s*<span[^>]*class=["'][^"']*pron\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/span>`, "i");
      const m = html.match(blockRe);
      let ipa: string | undefined;
      if (m) ipa = stripHtml(m[1]).replace(/^\/|\/$/g, "");
      const sourceRe = new RegExp(`class=["'][^"']*\\b${region}dpron[^"']*["'][\\s\\S]{0,500}?<source[^>]+src=["']([^"']+)["']`, "i");
      const sm = html.match(sourceRe);
      const audioUrl = sm ? (sm[1].startsWith("http") ? sm[1] : `https://dictionary.cambridge.org${sm[1]}`) : undefined;
      if (ipa || audioUrl) results.push({ region, ipa, audioUrl });
    }
  } catch (e) {
    console.error("[cambridge crawl] pronunciation parse failed", e);
  }
  return results;
}

function parseSenses(html: string): CambridgeSenseBlock[] {
  const senses: CambridgeSenseBlock[] = [];
  try {
    const entryBlocks = extractBlocks(html, "pr dictionary");
    const posBlocks = entryBlocks.length > 0 ? entryBlocks : [html];

    for (const block of posBlocks) {
      let partOfSpeech: string | undefined;
      try {
        const posMatch = block.match(/<span[^>]*class=["'][^"']*\bpos\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
        if (posMatch) partOfSpeech = stripHtml(posMatch[1]);
      } catch (e) {
        console.error("[cambridge crawl] pos parse failed", e);
      }

      const definitions: { text: string; examples: string[] }[] = [];
      try {
        const defBlocks = extractBlocks(block, "def-block");
        const blocksToUse = defBlocks.length > 0 ? defBlocks : extractBlocks(block, "sense-body");
        for (const defBlock of blocksToUse) {
          let text = "";
          try {
            const defMatch = defBlock.match(/<div[^>]*class=["'][^"']*\bdef\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
            if (defMatch) text = stripHtml(defMatch[1]).replace(/:\s*$/, "");
          } catch (e) {
            console.error("[cambridge crawl] definition text parse failed", e);
          }
          if (!text) continue;

          const examples: string[] = [];
          try {
            const exMatches = [...defBlock.matchAll(/<span[^>]*class=["'][^"']*\beg\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi)];
            for (const ex of exMatches) {
              const t = stripHtml(ex[1]);
              if (t) examples.push(t);
            }
          } catch (e) {
            console.error("[cambridge crawl] examples parse failed", e);
          }

          definitions.push({ text, examples: examples.slice(0, 5) });
        }
      } catch (e) {
        console.error("[cambridge crawl] def-block parse failed", e);
      }

      if (definitions.length > 0) {
        senses.push({ partOfSpeech, definitions: definitions.slice(0, 10) });
      }
    }
  } catch (e) {
    console.error("[cambridge crawl] senses parse failed", e);
  }
  return senses.slice(0, 15);
}

function parseSynonyms(html: string): string[] {
  try {
    const block = html.match(/<div[^>]*class=["'][^"']*\bsynonyms?\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    if (!block) return [];
    const items = [...block[1].matchAll(/<span[^>]*class=["'][^"']*\bsynonym\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi)];
    return [...new Set(items.map((m) => stripHtml(m[1])).filter(Boolean))].slice(0, 20);
  } catch (e) {
    console.error("[cambridge crawl] synonyms parse failed", e);
    return [];
  }
}

async function fetchCambridgeEntry(word: string): Promise<CambridgeCrawlData> {
  const url = `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(word.trim().toLowerCase())}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; personal-study-tool/1.0; +https://example.com)",
      Accept: "text/html",
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error(`Cambridge request failed: ${res.status}`);
  }

  const html = await res.text();

  const pronunciations = parsePronunciations(html);
  const senses = parseSenses(html);
  const synonyms = parseSynonyms(html);

  const result: CambridgeCrawlData = {
    source: "cambridge",
    parserVersion: PARSER_VERSION,
    fetchedAt: new Date().toISOString(),
    url,
    word,
    pronunciations,
    senses,
    synonyms,
  };

  if (senses.length === 0 && pronunciations.length === 0) {
    // Structured parsing found nothing useful — keep a raw text fallback so the
    // user still gets something, and so it's obvious in the UI that parsing failed
    // rather than the word simply having no entry.
    try {
      const bodyMatch = html.match(/<body[\s\S]*?<\/body>/i);
      result.raw = bodyMatch ? stripHtml(bodyMatch[0]).slice(0, 3000) : undefined;
    } catch (e) {
      console.error("[cambridge crawl] raw fallback failed", e);
    }
  }

  return result;
}

function hasUsefulData(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const d = data as Partial<CambridgeCrawlData>;
  // Only structured data counts as "useful" (cache-worthy / skip-refetch).
  // A `raw` fallback means parsing found nothing — it's shown once but should
  // not stop a future lookup from trying to parse again (e.g. after the site
  // blocked/served an interstitial instead of the real entry).
  return d.parserVersion === PARSER_VERSION && ((d.senses?.length ?? 0) > 0 || (d.pronunciations?.length ?? 0) > 0);
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

    const crawlData = await fetchCambridgeEntry(word);
    if (wordId && hasUsefulData(crawlData)) await upsertWordCrawlData(wordId, crawlData);

    return NextResponse.json({ crawlData, cached: false });
  } catch (e) {
    console.error("[GET english/crawl error]", e);
    // Cambridge commonly blocks non-browser requests (403) or times out — this
    // is an expected, user-facing failure mode for a best-effort scrape, not a
    // server bug, so respond 200 with a clear error field the UI can show
    // instead of surfacing a raw 500.
    const message = e instanceof Error ? e.message : "unknown error";
    const blocked = message.includes("403") || message.includes("429");
    return NextResponse.json(
      { error: blocked ? "Cambridge đã chặn truy vấn này (403). Thử lại sau." : "Không lấy được dữ liệu từ Cambridge." },
      { status: 200 }
    );
  }
}
