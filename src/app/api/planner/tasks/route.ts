import { NextRequest, NextResponse } from "next/server";
import { getUserId, unauthorized } from "@/src/lib/auth";
import { ensurePlannerTables, listTasks, createTask } from "@/src/lib/planner-db";

export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensurePlannerTables();

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "from and to are required" }, { status: 400 });
  }

  const tasks = await listTasks(userId, from, to);
  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensurePlannerTables();

  const body = await req.json();
  const date = body?.date as string | undefined;
  const text = (body?.text as string | undefined)?.trim();
  const checked = !!body?.checked;
  if (!date || !text) {
    return NextResponse.json({ error: "date and text are required" }, { status: 400 });
  }

  const task = await createTask(userId, date, text, checked);
  return NextResponse.json(task, { status: 201 });
}
