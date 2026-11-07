import { NextRequest, NextResponse } from "next/server";
import { ensureEnglishTables, findWordByText } from "@/src/lib/english-db";
import { getUserId, unauthorized } from "@/src/lib/auth";

// Cheap, non-AI duplicate check — called before any AI route (lemmatize/
// gloss/ai-define) so the pipeline never spends tokens re-defining a word
// the user already has. Used by both the web app and the browser extension.
export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  try {
    await ensureEnglishTables();
    const word = req.nextUrl.searchParams.get("word")?.trim();
    if (!word) return NextResponse.json({ exists: false });
    const existing = await findWordByText(userId, word);
    if (!existing) return NextResponse.json({ exists: false });
    return NextResponse.json({ exists: true, id: existing.id, word: existing.word });
  } catch (e) {
    console.error("[GET english/words/exists error]", e);
    return NextResponse.json({ exists: false, error: "db error" }, { status: 500 });
  }
}
