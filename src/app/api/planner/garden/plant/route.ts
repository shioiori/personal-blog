import { NextRequest, NextResponse } from "next/server";
import { getUserId, unauthorized } from "@/src/lib/auth";
import { ensureGardenTables, plantSeed } from "@/src/lib/garden-db";

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensureGardenTables();

  const body = await req.json();
  const plotId = Number(body?.plotId);
  const cropId = body?.cropId as string | undefined;
  const fertilizerId = (body?.fertilizerId as string | undefined) ?? null;
  if (!plotId || !cropId) {
    return NextResponse.json({ error: "plotId and cropId are required" }, { status: 400 });
  }

  const result = await plantSeed(userId, plotId, cropId, fertilizerId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
