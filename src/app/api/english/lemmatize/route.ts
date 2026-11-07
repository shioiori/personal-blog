import { NextRequest, NextResponse } from "next/server";
import { getUserId, unauthorized } from "@/src/lib/auth";
import { localNormalize } from "@/src/lib/english-lemmatize";

// Local, non-AI lemmatization endpoint for the browser extension, which
// can't import wink-lemmatizer directly (plain content/background scripts,
// no bundler). The web app itself calls localNormalize() in-process via
// validateAndNormalizeWord — this route exposes the same logic over HTTP.
export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  const word = req.nextUrl.searchParams.get("word")?.trim();
  if (!word) return NextResponse.json({ valid: false, reason: "Không có từ nào được chọn." });
  return NextResponse.json({ valid: true, normalized: localNormalize(word) });
}
