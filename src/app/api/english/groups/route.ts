import { NextRequest, NextResponse } from "next/server";
import { ensureEnglishTables, listGroups, createGroup } from "@/src/lib/english-db";
import { getUserId, unauthorized } from "@/src/lib/auth";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensureEnglishTables();
  const groups = await listGroups(userId);
  return NextResponse.json(groups);
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensureEnglishTables();
  const { name } = (await req.json()) as { name: string };
  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });
  const created = await createGroup(userId, name.trim());
  return NextResponse.json(created);
}
