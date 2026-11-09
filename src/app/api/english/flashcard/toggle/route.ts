import { NextRequest, NextResponse } from "next/server";
import { ensureEnglishTables, setFlashcardActive } from "@/src/lib/english-db";
import { getUserId, unauthorized } from "@/src/lib/auth";

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  try {
    await ensureEnglishTables();
    const { wordIds, active } = (await req.json()) as { wordIds: number[]; active: boolean };
    if (!Array.isArray(wordIds) || wordIds.length === 0) return NextResponse.json({ error: "wordIds required" }, { status: 400 });
    await setFlashcardActive(userId, wordIds, !!active);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[POST english/flashcard/toggle error]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
