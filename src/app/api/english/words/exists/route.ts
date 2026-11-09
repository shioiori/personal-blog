import { NextRequest, NextResponse } from "next/server";
import { createWord, ensureEnglishTables, findWordByText, getWord, linkWordToSourceGroup } from "@/src/lib/english-db";
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
    const mode = req.nextUrl.searchParams.get("otherUser") ?? "clone";
    const sourceUrl = req.nextUrl.searchParams.get("sourceUrl")?.trim() || null;
    const match = await findWordByText(userId, word, getLemmaCandidates(word), mode !== "skip");
    if (!match) return NextResponse.json({ exists: false });
    if (match.userId === userId) {
      // Extension may be re-adding this word from a different page: group it
      // under the new page's hostname too (a no-op if that hostname's group
      // already has this word).
      if (sourceUrl) await linkWordToSourceGroup(userId, match.id, sourceUrl);
      return NextResponse.json({ exists: true, id: match.id, word: match.word });
    }
    const other = await getWord(match.userId, match.id);
    if (!other) return NextResponse.json({ exists: false });
    const senses = other.senses.map((s) => ({ ...s, images: [] }));
    if (mode === "fill") {
      // Web modal path: just hand back the other user's data to prefill the
      // form. Nothing is written yet — handleSave decides, once the user
      // saves, whether this ends up a live reference (untouched) or a fork
      // with their edits (see EditWordModal.handleSave).
      return NextResponse.json({
        exists: false,
        originWordId: match.id,
        source: { word: other.word, senses, relatedWords: other.relatedWords ?? null, altSpelling: other.altSpelling ?? null, crawlData: other.crawlData ?? null },
      });
    }
    // Quick-add path (browser extension, no editing step): add it as a pure
    // reference — no sense rows of its own, so it always shows the origin
    // owner's current data until this user edits it from the word list.
    const ref = await createWord(userId, other.word, [], undefined, other.relatedWords, other.altSpelling, sourceUrl, match.id);
    return NextResponse.json({ exists: true, cloned: true, id: ref.id, word: ref.word });
  } catch (e) {
    console.error("[GET english/words/exists error]", e);
    return NextResponse.json({ exists: false, error: "db error" }, { status: 500 });
  }
}
