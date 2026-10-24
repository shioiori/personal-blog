import { NextResponse } from "next/server";
import { ensureEnglishTables, getDueForecast } from "@/src/lib/english-db";

export async function GET() {
  try {
    await ensureEnglishTables();
    const days = await getDueForecast();
    return NextResponse.json({ days });
  } catch (e) {
    console.error("[GET english/flashcard/forecast error]", e);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }
}
