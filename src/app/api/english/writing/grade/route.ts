import { NextRequest, NextResponse } from "next/server";
import { ensureEnglishTables } from "@/src/lib/english-db";
import { ensureWritingTables, upsertWritingGrade } from "@/src/lib/english-writing-db";
import { getCurrentUser, isPremium, unauthorized } from "@/src/lib/auth";

// Direct grade submission — used for the "forget" path (user picked ✗ on
// the Vietnamese-meaning prompt), which skips straight to grading without
// writing a sentence or calling the AI checker.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!isPremium(user)) return NextResponse.json({ needsPremium: true }, { status: 403 });
  try {
    await ensureEnglishTables();
    await ensureWritingTables();
    const { wordId, grade } = (await req.json()) as { wordId: number; grade: 0 | 1 | 2 | 3 };
    if (!wordId || ![0, 1, 2, 3].includes(grade)) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }
    if (!(await upsertWritingGrade(user.id, wordId, grade))) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[POST english/writing/grade error]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
