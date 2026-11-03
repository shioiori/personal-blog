import { NextRequest, NextResponse } from "next/server";
import {
  ensureCompoundTables,
  getCompoundCategories,
  createCompoundCategory,
  updateCompoundCategory,
  deleteCompoundCategory,
} from "@/src/lib/chinese-db";
import { getUserId, unauthorized } from "@/src/lib/auth";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensureCompoundTables();
  const data = await getCompoundCategories(userId);
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensureCompoundTables();
  const { name } = await req.json();
  const created = await createCompoundCategory(userId, name as string);
  return NextResponse.json(created);
}

export async function PUT(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  const { id, name } = await req.json();
  await updateCompoundCategory(userId, id as number, name as string);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  const { id } = await req.json();
  await deleteCompoundCategory(userId, id as number);
  return NextResponse.json({ ok: true });
}
