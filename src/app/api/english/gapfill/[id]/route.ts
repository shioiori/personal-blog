import { NextRequest, NextResponse } from "next/server";
import { getUserId, unauthorized } from "@/src/lib/auth";
import { deleteExercise, ensureGapFillTables, getExercise } from "@/src/lib/english-gapfill-db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensureGapFillTables();
  const { id } = await params;
  const exercise = await getExercise(userId, parseInt(id, 10));
  if (!exercise) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ exercise });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensureGapFillTables();
  const { id } = await params;
  await deleteExercise(userId, parseInt(id, 10));
  return NextResponse.json({ ok: true });
}
