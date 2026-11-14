import { NextRequest, NextResponse } from "next/server";
import { getUserId, unauthorized } from "@/src/lib/auth";
import { ensureGardenTables, harvestPlot } from "@/src/lib/garden-db";

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensureGardenTables();

  const body = await req.json();
  const plotId = Number(body?.plotId);
  if (!plotId) return NextResponse.json({ error: "plotId is required" }, { status: 400 });

  const result = await harvestPlot(userId, plotId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
