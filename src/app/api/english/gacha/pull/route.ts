import { NextResponse } from "next/server";
import { ensureGachaTables, pull, spendTicket } from "@/src/lib/english-gacha-db";

export async function POST() {
  try {
    await ensureGachaTables();
    const spent = await spendTicket();
    if (!spent) {
      return NextResponse.json({ error: "no tickets" }, { status: 400 });
    }
    const result = await pull();
    return NextResponse.json({ result });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }
}
