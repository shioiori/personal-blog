import { NextRequest, NextResponse } from "next/server";
import { generateReviewText } from "@/src/service/chinese";

function getSession(req: NextRequest): string {
  return req.cookies.get("chinese_session")?.value ?? crypto.randomUUID();
}

export async function GET(req: NextRequest) {
  try {
    const sessionId = getSession(req);
    const result = await generateReviewText(sessionId);

    if (result.status === "no_words") {
      return NextResponse.json({ error: "no_words", learnedCount: 0 });
    }
    if (result.status === "too_few") {
      return NextResponse.json({ error: "too_few", learnedCount: result.learnedCount, minWords: result.minWords });
    }

    const res = NextResponse.json({ text: result.text, learnedCount: result.learnedCount });
    res.cookies.set("chinese_session", sessionId, { path: "/", maxAge: 60 * 60 * 24 * 365 });
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
