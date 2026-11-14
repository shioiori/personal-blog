import { NextRequest, NextResponse } from "next/server";
import { getUserId, unauthorized } from "@/src/lib/auth";
import { ensurePlannerTables, listCategories, createCategory } from "@/src/lib/planner-db";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensurePlannerTables();
  return NextResponse.json(await listCategories(userId));
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensurePlannerTables();

  const body = await req.json();
  const name = (body?.name as string | undefined)?.trim();
  const color = (body?.color as string | undefined)?.trim();
  if (!name || !color) {
    return NextResponse.json({ error: "name and color are required" }, { status: 400 });
  }

  const category = await createCategory(userId, name, color);
  return NextResponse.json(category, { status: 201 });
}
