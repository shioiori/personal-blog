import { NextRequest, NextResponse } from "next/server";
import { getUserId, unauthorized } from "@/src/lib/auth";
import { buyItem, ensureGardenTables, getBalance } from "@/src/lib/garden-db";

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensureGardenTables();

  const body = await req.json();
  const itemId = body?.itemId as string | undefined;
  const qty = body?.qty === undefined ? 1 : Number(body.qty);
  if (!itemId) return NextResponse.json({ error: "itemId is required" }, { status: 400 });

  await getBalance(userId); // make sure the wallet row exists
  const result = await buyItem(userId, itemId, qty);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
