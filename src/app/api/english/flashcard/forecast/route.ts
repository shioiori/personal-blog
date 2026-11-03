import { NextResponse } from "next/server";
import { ensureEnglishTables, getDueForecast } from "@/src/lib/english-db";
import { getUserId, unauthorized } from "@/src/lib/auth";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  try {
    await ensureEnglishTables();
    const days = await getDueForecast(userId);
    return NextResponse.json({ days });
  } catch (e) {
    console.error("[GET english/flashcard/forecast error]", e);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }
}
