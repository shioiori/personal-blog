import { NextRequest, NextResponse } from "next/server";
import { getUserId, unauthorized } from "@/src/lib/auth";
import { ensurePlannerTables, deleteCategory } from "@/src/lib/planner-db";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensurePlannerTables();

  const { id } = await params;
  await deleteCategory(userId, Number(id));
  return NextResponse.json({ ok: true });
}
