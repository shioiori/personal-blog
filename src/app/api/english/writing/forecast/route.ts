import { NextResponse } from "next/server";
import { ensureEnglishTables } from "@/src/lib/english-db";
import { ensureWritingTables, getWritingDueForecast } from "@/src/lib/english-writing-db";
import { getUserId, unauthorized } from "@/src/lib/auth";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  try {
    await ensureEnglishTables();
    await ensureWritingTables();
    return NextResponse.json({ days: await getWritingDueForecast(userId) });
  } catch (e) {
    console.error("[GET english/writing/forecast error]", e);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }
}
