import { NextRequest, NextResponse } from "next/server";
import { ensureEnglishTables, setFlashcardActive } from "@/src/lib/english-db";
import { getUserId, unauthorized } from "@/src/lib/auth";

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  try {
    await ensureEnglishTables();
    const { wordId, active } = (await req.json()) as { wordId: number; active: boolean };
    if (!wordId) return NextResponse.json({ error: "wordId required" }, { status: 400 });
    await setFlashcardActive(userId, wordId, !!active);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[POST english/flashcard/toggle error]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
