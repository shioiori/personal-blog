import { NextResponse } from "next/server";
import { ensureGachaTables, getCollection, getExchangeTicketCount, getTicketCount } from "@/src/lib/english-gacha-db";

export async function GET() {
  try {
    await ensureGachaTables();
    const [tickets, exchangeTickets, collection] = await Promise.all([
      getTicketCount(),
      getExchangeTicketCount(),
      getCollection(),
    ]);
    return NextResponse.json({ tickets, exchangeTickets, collection });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }
}
