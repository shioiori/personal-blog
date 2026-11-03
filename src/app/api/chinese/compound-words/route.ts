import { NextRequest, NextResponse } from "next/server";
import {
  ensureCompoundTables,
  getCompoundWords,
  createCompoundWord,
  updateCompoundWord,
  deleteCompoundWord,
} from "@/src/lib/chinese-db";
import { getUserId, unauthorized } from "@/src/lib/auth";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensureCompoundTables();
  const data = await getCompoundWords(userId);
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensureCompoundTables();
  const { word, meaning, pinyin, hanViet, note, categoryIds } = await req.json();
  const created = await createCompoundWord(
    userId,
    word as string,
    meaning as string,
    pinyin as string,
    hanViet as string,
    note as string,
    categoryIds as number[]
  );
  return NextResponse.json(created);
}

export async function PUT(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  const { id, word, meaning, pinyin, hanViet, note, categoryIds } = await req.json();
  await updateCompoundWord(
    userId,
    id as number,
    word as string,
    meaning as string,
    pinyin as string,
    hanViet as string,
    note as string,
    categoryIds as number[]
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  const { id } = await req.json();
  await deleteCompoundWord(userId, id as number);
  return NextResponse.json({ ok: true });
}
