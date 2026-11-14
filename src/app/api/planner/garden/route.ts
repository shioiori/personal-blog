import { NextResponse } from "next/server";
import { getUserId, unauthorized } from "@/src/lib/auth";
import { ensureGardenTables, getBalance, getInventory, listPlots } from "@/src/lib/garden-db";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensureGardenTables();

  const [plots, balance, inventory] = await Promise.all([listPlots(userId), getBalance(userId), getInventory(userId)]);
  return NextResponse.json({ plots, balance, inventory });
}
