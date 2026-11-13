import { NextRequest, NextResponse } from "next/server";
import { getUserId, unauthorized } from "@/src/lib/auth";
import { ensurePlannerTables, syncTasks } from "@/src/lib/planner-db";
import { parseTasks } from "@/src/lib/planner-text";

export async function PUT(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensurePlannerTables();

  const body = await req.json();
  const from = body?.from as string | undefined;
  const to = body?.to as string | undefined;
  const text = body?.text;
  if (!from || !to || typeof text !== "string") {
    return NextResponse.json({ error: "from, to and text are required" }, { status: 400 });
  }

  const result = parseTasks(text);
  if ("errorLine" in result) return NextResponse.json(result, { status: 400 });

  await syncTasks(userId, from, to, result.tasks);
  return NextResponse.json({ ok: true });
}
