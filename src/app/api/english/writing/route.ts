import { NextRequest, NextResponse } from "next/server";
import { ensureEnglishTables } from "@/src/lib/english-db";
import { ensureWritingTables, getWritingDueToday } from "@/src/lib/english-writing-db";
import { getCurrentUser, isPremium, unauthorized } from "@/src/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!isPremium(user)) return NextResponse.json({ needsPremium: true }, { status: 403 });
  try {
    await ensureEnglishTables();
    await ensureWritingTables();
    const limitParam = req.nextUrl.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 0;
    const order = (req.nextUrl.searchParams.get("order") ?? "due") as "due" | "random";
    const cards = await getWritingDueToday(user.id, { limit, order });
    return NextResponse.json({ cards, total: cards.length });
  } catch (e) {
    console.error("[GET english/writing error]", e);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }
}
