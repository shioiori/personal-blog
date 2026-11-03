import { NextRequest, NextResponse } from "next/server";
import { ensureEnglishTables, renameGroup, deleteGroup } from "@/src/lib/english-db";
import { getUserId, unauthorized } from "@/src/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensureEnglishTables();
  const { id } = await params;
  const { name } = (await req.json()) as { name: string };
  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });
  await renameGroup(userId, parseInt(id, 10), name.trim());
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensureEnglishTables();
  const { id } = await params;
  await deleteGroup(userId, parseInt(id, 10));
  return NextResponse.json({ ok: true });
}
