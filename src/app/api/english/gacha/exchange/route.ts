import { NextRequest, NextResponse } from "next/server";
import { ensureGachaTables, exchangeForPiece } from "@/src/lib/english-gacha-db";
import { getUserId, unauthorized } from "@/src/lib/auth";

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  try {
    await ensureGachaTables();
    const { chainKey } = (await req.json()) as { chainKey: string };
    if (!chainKey) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }
    const result = await exchangeForPiece(userId, chainKey);
    return NextResponse.json({ result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
