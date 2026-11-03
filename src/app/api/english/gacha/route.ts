import { NextResponse } from "next/server";
import { ensureGachaTables, getCollection, getExchangeTicketCount, getTicketCount } from "@/src/lib/english-gacha-db";
import { getUserId, unauthorized } from "@/src/lib/auth";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  try {
    await ensureGachaTables();
    const [tickets, exchangeTickets, collection] = await Promise.all([
      getTicketCount(userId),
      getExchangeTicketCount(userId),
      getCollection(userId),
    ]);
    return NextResponse.json({ tickets, exchangeTickets, collection });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }
}
