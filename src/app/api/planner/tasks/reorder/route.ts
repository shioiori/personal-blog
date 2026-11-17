import { NextRequest, NextResponse } from "next/server";
import { getUserId, unauthorized } from "@/src/lib/auth";
import { ensurePlannerTables, reorderTasks } from "@/src/lib/planner-db";

export async function PUT(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensurePlannerTables();

  const body = await req.json();
  const ids = body?.ids;
  if (!Array.isArray(ids) || !ids.every((id) => Number.isInteger(id))) {
    return NextResponse.json({ error: "ids must be an array of integers" }, { status: 400 });
  }

  await reorderTasks(userId, ids);
  return NextResponse.json({ ok: true });
}
