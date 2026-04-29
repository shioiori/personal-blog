import { NextRequest, NextResponse } from "next/server";
import {
  ensureCompoundTables,
  getCompoundCategories,
  createCompoundCategory,
  updateCompoundCategory,
  deleteCompoundCategory,
} from "@/src/lib/chinese-db";

export async function GET() {
  await ensureCompoundTables();
  const data = await getCompoundCategories();
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  await ensureCompoundTables();
  const { name } = await req.json();
  const created = await createCompoundCategory(name as string);
  return NextResponse.json(created);
}

export async function PUT(req: NextRequest) {
  const { id, name } = await req.json();
  await updateCompoundCategory(id as number, name as string);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  await deleteCompoundCategory(id as number);
  return NextResponse.json({ ok: true });
}
