import { NextRequest, NextResponse } from "next/server";
import { ensureTables, ensureFlashcardTables, getFlashcardsDueToday, upsertFlashcard, type FlashcardMode } from "@/src/lib/chinese-db";

export async function GET(req: NextRequest) {
  try {
    await ensureTables();
    await ensureFlashcardTables();
    const mode = (req.nextUrl.searchParams.get("mode") ?? "flip") as FlashcardMode;
    const cards = await getFlashcardsDueToday(mode);
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
    console.error(e);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }
}
