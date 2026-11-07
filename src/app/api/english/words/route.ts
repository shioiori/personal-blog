import { NextRequest, NextResponse } from "next/server";
import { ensureEnglishTables, listWords, createWord, type SenseInput } from "@/src/lib/english-db";
import { getUserId, unauthorized } from "@/src/lib/auth";

export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  try {
    await ensureEnglishTables();
    const groupIdParam = req.nextUrl.searchParams.get("groupId");
    const search = req.nextUrl.searchParams.get("search") ?? undefined;
    const groupId = groupIdParam ? parseInt(groupIdParam, 10) : undefined;
    const words = await listWords(userId, { groupId, search });
    return NextResponse.json(words);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  try {
    await ensureEnglishTables();
    const body = (await req.json()) as { word: string; senses?: SenseInput[]; crawlData?: unknown; relatedWords?: string | null; altSpelling?: string | null; sourceUrl?: string | null };
    if (!body.word?.trim()) {
      return NextResponse.json({ error: "word is required" }, { status: 400 });
    }
    const created = await createWord(userId, body.word.trim(), body.senses ?? [], body.crawlData, body.relatedWords, body.altSpelling, body.sourceUrl);
    return NextResponse.json(created);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[POST english/words error]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
