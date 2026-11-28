import { NextRequest, NextResponse } from "next/server";
import { getUserId, unauthorized } from "@/src/lib/auth";
import { ensureEssayTables, listCategoryGroups, setCategoryGroups } from "@/src/lib/english-essay-db";
import { isEssayCategory } from "@/src/lib/essay-categories";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensureEssayTables();
  return NextResponse.json(await listCategoryGroups(userId));
}

export async function PUT(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensureEssayTables();
  let body: { category?: unknown; groupIds?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  if (!isEssayCategory(body.category) || !Array.isArray(body.groupIds)) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const groupIds = [...new Set(body.groupIds.filter((id): id is number => Number.isInteger(id)))];
  return NextResponse.json({ groupIds: await setCategoryGroups(userId, body.category, groupIds) });
}
