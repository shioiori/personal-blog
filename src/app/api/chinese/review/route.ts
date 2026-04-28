import { NextResponse } from "next/server";
import { generateReviewText } from "@/src/service/chinese";
import { ensureTables, getDailyUsage, incrementDailyLimit } from "@/src/lib/chinese-db";

const DAILY_LIMIT = 100;

export async function GET() {
  try {
    await ensureTables();

    const used = await getDailyUsage();
    if (used >= DAILY_LIMIT) {
      return NextResponse.json({ error: "rate_limited", used, limit: DAILY_LIMIT }, { status: 429 });
    }

    const result = await generateReviewText();

    if (result.status === "no_words") {
      return NextResponse.json({ error: "no_words", learnedCount: 0 });
    }
    if (result.status === "too_few") {
      return NextResponse.json({ error: "too_few", learnedCount: result.learnedCount, minWords: result.minWords });
    }

    await incrementDailyLimit();
    return NextResponse.json({ text: result.text, learnedCount: result.learnedCount });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
