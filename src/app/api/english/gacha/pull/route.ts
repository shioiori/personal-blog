import { NextResponse } from "next/server";
import { ensureGachaTables, pull, spendTicket } from "@/src/lib/english-gacha-db";
import { getUserId, unauthorized } from "@/src/lib/auth";

export async function POST() {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  try {
    await ensureGachaTables();
    const spent = await spendTicket(userId);
    if (!spent) {
      return NextResponse.json({ error: "no tickets" }, { status: 400 });
    }
    const result = await pull(userId);
    return NextResponse.json({ result });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }
}
