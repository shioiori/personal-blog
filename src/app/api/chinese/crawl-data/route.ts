import { NextRequest, NextResponse } from "next/server";
import {
  ensureTables,
  getCardCrawlData,
  upsertCardCrawlData,
} from "@/src/lib/chinese-db";

const THIVIEN_TRANSCRIPT_API = "https://hvdic.thivien.net/transcript-query.json.php";
const THIVIEN_PARSER_VERSION = 2;

interface ThiVienCrawlData {
  source: "thivien";
  parserVersion: number;
  fetchedAt: string;
  transcript?: unknown;
  dictionary?: {
    url: string;
    hanzi: string;
    pinyin: string;
    hanviet: string;
    meanings: string[];
    lines: string[];
    definitions: { source: string; text: string }[];
    rawText: string;
  };
  payload?: unknown;
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

function htmlToLines(html: string) {
  const text = decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "\n")
      .replace(/<style[\s\S]*?<\/style>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h\d|tr|section|article|table)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  );

  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function stripHtml(html: string) {
  return decodeHtml(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+\n/g, "\n")
      .replace(/\n\s+/g, "\n")
      .replace(/[ \t]+/g, " ")
  ).trim();
}

function unique(values: string[]) {
  return values.filter((value, index, all) => value && all.indexOf(value) === index);
}

function formatMeaning(text: string) {
  if (!text) return text;
  const han = "一-鿿㐀-䶿";
  const hanPunct = "　-〿＀-￯";
  const vi = "A-Za-zÀ-ỹĐđ";

  let result = text.replace(/\r/g, "");
  result = result.replace(
    new RegExp(`([${vi}\\.\\?;:,!"'\\)\\]])\\s+([${han}])`, "g"),
    "$1\n$2"
  );
  result = result.replace(
    new RegExp(`([${han}][${hanPunct}]?)\\s+([${vi}])`, "g"),
    "$1\n$2"
  );
  result = result.replace(/;\s+/g, ";\n");
  return result.replace(/\n{2,}/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
}

function pickDictionaryLines(lines: string[]) {
  const prefixes = [
    "Âm Nôm:",
    "Tổng nét:",
    "Bộ:",
    "Lục thư:",
    "Hình thái:",
    "Nét bút:",
    "Thương Hiệt:",
    "Unicode:",
    "Độ thông dụng",
    "Âm Hán Việt:",
    "Âm Quan thoại:",
    "Âm Nhật",
    "Âm Hàn:",
    "Âm Quảng Đông:",
  ];

  return lines
    .filter((line) => prefixes.some((prefix) => line.startsWith(prefix)))
    .filter((line, index, all) => all.indexOf(line) === index)
    .slice(0, 12);
}

function pickDefinitions(lines: string[]) {
  const definitions: { source: string; text: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("Từ điển ")) continue;

    const source = line;
    if (source === "Từ điển Hán Nôm") continue;
    const text = lines
      .slice(i + 1, i + 5)
      .find((candidate) => {
        return (
          candidate &&
          !candidate.startsWith("Từ điển ") &&
          !candidate.includes("phồn & giản thể") &&
          !candidate.startsWith("©")
        );
      });

    if (text) definitions.push({ source, text });
  }

  return definitions
    .filter((item, index, all) => all.findIndex((other) => other.source === item.source && other.text === item.text) === index)
    .slice(0, 5);
}

async function fetchThiVienTranscript(char: string) {
  const body = new URLSearchParams({
    mode: "trans",
    lang: "1",
    input: char,
  });

  const res = await fetch(THIVIEN_TRANSCRIPT_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`ThiVien request failed: ${res.status}`);
  }

  const payload = (await res.json()) as unknown;
  return payload;
}

async function fetchThiVienDictionary(char: string) {
  const url = `https://hvdic.thivien.net/whv/${encodeURIComponent(char)}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`ThiVien dictionary request failed: ${res.status}`);
  }

  const html = await res.text();
  const lines = htmlToLines(html);
  const pinyin = unique(
    [...html.matchAll(/<a[^>]+href=["']\/py\/[^"']+["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .map((match) => stripHtml(match[1]).split(/\s+/)[0])
  ).join(", ");
  const hanviet = unique(
    [...html.matchAll(/<p[^>]*class=["'][^"']*hvres-spell[^"']*["'][^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/p>/gi)]
      .map((match) => stripHtml(match[1]))
  ).join(", ");
  const meanings = unique(
    [...html.matchAll(/<p[^>]*class=["'][^"']*hvres-source[^"']*["'][^>]*>((?:(?!<\/p>).)*)<\/p>\s*<div[^>]*class=["'][^"']*hvres-meaning[^"']*han-clickable[^"']*["'][^>]*>((?:(?!<\/div>).)*)<\/div>/gis)]
      .map((match) => {
        const source = stripHtml(match[1]);
        const text = formatMeaning(stripHtml(match[2]));
        if (!text || text.length <= 1 || text.length >= 1500) return "";
        return source ? `[${source}] ${text}` : text;
      })
  ).slice(0, 5);

  return {
    url,
    hanzi: char,
    pinyin,
    hanviet,
    meanings: meanings.length > 0 ? meanings : ["Không tìm thấy nghĩa trong từ điển."],
    lines: pickDictionaryLines(lines),
    definitions: pickDefinitions(lines),
    rawText: lines.slice(0, 120).join("\n"),
  };
}

function hasDictionaryData(data: unknown) {
  return Boolean(
    data &&
      typeof data === "object" &&
      "dictionary" in data &&
      (data as { parserVersion?: number }).parserVersion === THIVIEN_PARSER_VERSION &&
      ((data as { dictionary?: { meanings?: unknown[] } }).dictionary?.meanings?.length ?? 0) > 0
  );
}

async function fetchThiVienData(char: string, existing?: unknown): Promise<ThiVienCrawlData> {
  const existingObject =
    existing && typeof existing === "object" ? (existing as Partial<ThiVienCrawlData>) : {};

  const [transcript, dictionary] = await Promise.all([
    existingObject.transcript ?? existingObject.payload ?? fetchThiVienTranscript(char),
    hasDictionaryData(existing) ? existingObject.dictionary : fetchThiVienDictionary(char),
  ]);

  return {
    source: "thivien",
    parserVersion: THIVIEN_PARSER_VERSION,
    fetchedAt: new Date().toISOString(),
    transcript,
    dictionary,
  };
}

export async function GET(req: NextRequest) {
  try {
    const char = req.nextUrl.searchParams.get("char")?.trim();
    if (!char) {
      return NextResponse.json({ error: "missing_char" }, { status: 400 });
    }

    await ensureTables();

    const cached = await getCardCrawlData(char);
    if (cached && hasDictionaryData(cached)) {
      return NextResponse.json({ crawlData: cached, cached: true });
    }

    const crawlData = await fetchThiVienData(char, cached);
    await upsertCardCrawlData(char, crawlData);

    return NextResponse.json({ crawlData, cached: false });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
