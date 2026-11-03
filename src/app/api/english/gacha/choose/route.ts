import { NextRequest, NextResponse } from "next/server";
import { chooseEvolution, ensureGachaTables } from "@/src/lib/english-gacha-db";
import { getUserId, unauthorized } from "@/src/lib/auth";

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  try {
    await ensureGachaTables();
    const { chainKey, speciesId } = (await req.json()) as { chainKey: string; speciesId: number };
    if (!chainKey || !speciesId) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }
    const species = await chooseEvolution(userId, chainKey, speciesId);
    return NextResponse.json({ species });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[POST english/gacha/choose error]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
