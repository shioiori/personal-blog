import { NextRequest, NextResponse } from "next/server";
import { ensureEnglishTables, getFlashcardsDueToday, upsertFlashcardGrade } from "@/src/lib/english-db";

export async function GET(req: NextRequest) {
  try {
    await ensureEnglishTables();
    const limitParam = req.nextUrl.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 0;
    const order = (req.nextUrl.searchParams.get("order") ?? "due") as "due" | "random";
    const cards = await getFlashcardsDueToday({ limit, order });
    return NextResponse.json({ cards, total: cards.length });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureEnglishTables();
    const { wordId, grade } = (await req.json()) as { wordId: number; grade: 0 | 1 | 2 | 3 };
    if (!wordId || ![0, 1, 2, 3].includes(grade)) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }
    await upsertFlashcardGrade(wordId, grade);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[POST english/flashcard error]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
