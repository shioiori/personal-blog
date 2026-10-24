import { NextRequest, NextResponse } from "next/server";
import { ensureEnglishTables, listWords, createWord, type SenseInput } from "@/src/lib/english-db";

export async function GET(req: NextRequest) {
  try {
    await ensureEnglishTables();
    const groupIdParam = req.nextUrl.searchParams.get("groupId");
    const search = req.nextUrl.searchParams.get("search") ?? undefined;
    const groupId = groupIdParam ? parseInt(groupIdParam, 10) : undefined;
    const words = await listWords({ groupId, search });
    return NextResponse.json(words);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureEnglishTables();
    const body = (await req.json()) as { word: string; senses?: SenseInput[]; crawlData?: unknown };
    if (!body.word?.trim()) {
      return NextResponse.json({ error: "word is required" }, { status: 400 });
    }
    const created = await createWord(body.word.trim(), body.senses ?? [], body.crawlData);
    return NextResponse.json(created);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[POST english/words error]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
