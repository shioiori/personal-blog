import { NextRequest, NextResponse } from "next/server";
import { ensureEnglishTables, findWordByText, linkWordToSourceGroup } from "@/src/lib/english-db";
import { getUserId, unauthorized } from "@/src/lib/auth";
import { getLemmaCandidates } from "@/src/lib/english-lemmatize";

// Cheap, non-AI duplicate check — called before any AI route (lemmatize/
// gloss/ai-define) so the pipeline never spends tokens re-defining a word
// the user already has. Also widens the match with a local, rule-based
// lemmatizer (e.g. "went" -> also tries "go") so common inflected forms of
// a word already in the DB are caught without any AI call.
export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  try {
    await ensureEnglishTables();
    const word = req.nextUrl.searchParams.get("word")?.trim();
    if (!word) return NextResponse.json({ exists: false });
    const existing = await findWordByText(userId, word, getLemmaCandidates(word));
    if (!existing) return NextResponse.json({ exists: false });
    // Extension may be re-adding this word from a different page: group it
    // under the new page's hostname too (a no-op if that hostname's group
    // already has this word).
    const sourceUrl = req.nextUrl.searchParams.get("sourceUrl")?.trim();
    if (sourceUrl) await linkWordToSourceGroup(userId, existing.id, sourceUrl);
    return NextResponse.json({ exists: true, id: existing.id, word: existing.word });
  } catch (e) {
    console.error("[GET english/words/exists error]", e);
    return NextResponse.json({ exists: false, error: "db error" }, { status: 500 });
  }
}
