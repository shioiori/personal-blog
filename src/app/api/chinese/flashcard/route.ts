import { NextRequest, NextResponse } from "next/server";
import { ensureTables, ensureFlashcardTables, getFlashcardsDueToday, upsertFlashcard, type FlashcardMode } from "@/src/lib/chinese-db";

export async function GET(req: NextRequest) {
  try {
    await ensureTables();
    await ensureFlashcardTables();
    const mode = (req.nextUrl.searchParams.get("mode") ?? "flip") as FlashcardMode;
    const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "0", 10);
    const order = req.nextUrl.searchParams.get("order") ?? "due";
    let cards = await getFlashcardsDueToday(mode);
    if (order === "random") cards = cards.sort(() => Math.random() - 0.5);
    if (limit > 0) cards = cards.slice(0, limit);
    return NextResponse.json({ cards, total: cards.length });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureFlashcardTables();
    const { char, grade, mode = "flip" } = await req.json() as { char: string; grade: 0 | 1 | 2 | 3; mode?: FlashcardMode };
    if (!char || ![0, 1, 2, 3].includes(grade)) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }
    await upsertFlashcard(char, grade, mode);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[POST flashcard error]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
