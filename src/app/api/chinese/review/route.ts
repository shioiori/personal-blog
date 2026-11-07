import { NextResponse } from "next/server";
import { generateReviewText } from "@/src/service/chinese";
import { getUserId, unauthorized } from "@/src/lib/auth";
import {
  ensureTables,
  getDailyUsage,
  incrementDailyLimit,
  ensureReviewHistoryTable,
  saveReviewHistory,
} from "@/src/lib/chinese-db";

const DAILY_LIMIT = 100;

// Temporarily disabled: the Groq model backing this (openai/gpt-oss-20b,
// after Groq retired the Llama models this previously used) produces
// degenerate repeating output on the long constrained passages this feature
// needs. Locked behind this flag until the prompt/model is tuned properly.
const REVIEW_GENERATION_DISABLED = true;

export async function GET(request: Request) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  if (REVIEW_GENERATION_DISABLED) {
    return NextResponse.json({ error: "disabled" });
  }
  try {
    await ensureTables();
    await ensureReviewHistoryTable();

    const used = await getDailyUsage();
    if (used >= DAILY_LIMIT) {
      return NextResponse.json({ error: "rate_limited", used, limit: DAILY_LIMIT }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const prioritizeRecent = searchParams.get("prioritizeRecent") === "true";

    const result = await generateReviewText(userId, prioritizeRecent);

    if (result.status === "no_words") {
      return NextResponse.json({ error: "no_words", learnedCount: 0 });
    }
    if (result.status === "too_few") {
      return NextResponse.json({ error: "too_few", learnedCount: result.learnedCount, minWords: result.minWords });
    }

    await incrementDailyLimit();
    await saveReviewHistory(userId, result.text, result.learnedCount);
    return NextResponse.json({ text: result.text, learnedCount: result.learnedCount });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
