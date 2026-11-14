import { NextRequest, NextResponse } from "next/server";
import { getUserId, unauthorized } from "@/src/lib/auth";
import { ensurePlannerTables, updateTask, deleteTask } from "@/src/lib/planner-db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensurePlannerTables();

  const { id } = await params;
  const body = await req.json();
  const text = typeof body?.text === "string" ? body.text.trim() : undefined;
  const checked = typeof body?.checked === "boolean" ? body.checked : undefined;
  const date = typeof body?.date === "string" ? body.date : undefined;
  const endDate = date && typeof body?.endDate === "string" && body.endDate > date ? body.endDate : null;
  const categoryId =
    body?.categoryId === null ? null : typeof body?.categoryId === "number" ? body.categoryId : undefined;

  const task = await updateTask(userId, Number(id), { text, checked, date, endDate, categoryId });
  if (!task) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(task);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensurePlannerTables();

  const { id } = await params;
  await deleteTask(userId, Number(id));
  return NextResponse.json({ ok: true });
}
