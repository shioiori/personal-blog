import { NextRequest, NextResponse } from "next/server";
import { ensureEnglishTables, renameGroup, deleteGroup } from "@/src/lib/english-db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureEnglishTables();
  const { id } = await params;
  const { name } = (await req.json()) as { name: string };
  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });
  await renameGroup(parseInt(id, 10), name.trim());
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureEnglishTables();
  const { id } = await params;
  await deleteGroup(parseInt(id, 10));
  return NextResponse.json({ ok: true });
}
