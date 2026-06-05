import { NextRequest, NextResponse } from "next/server";
import { CHINESE_DATA } from "@/src/data/chinese";
import { ensureTables, getCardCrawlData } from "@/src/lib/chinese-db";

async function getCachedCrawlData(char: string) {
  try {
    await ensureTables();
    return await getCardCrawlData(char);
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const char = req.nextUrl.searchParams.get("char");

  if (!char) {
    return NextResponse.json({ error: "Missing char parameter" }, { status: 400 });
  }

  const entry = CHINESE_DATA[char];
  const crawlData = await getCachedCrawlData(char);

  if (!entry) {
    return NextResponse.json({
      char,
      pinyin: null,
      meaning: null,
      hanViet: null,
      meaningVi: null,
      hsk: null,
      crawlData,
    });
  }

  return NextResponse.json({
    char: entry.char,
    pinyin: entry.pinyin,
    meaning: entry.meaning,
    hanViet: entry.hanViet ?? null,
    meaningVi: entry.meaningVi ?? null,
    hsk: entry.hsk,
    crawlData,
  });
}
