import { NextRequest, NextResponse } from "next/server";
import {
  ensureCompoundTables,
  getCompoundWords,
  createCompoundWord,
  updateCompoundWord,
  deleteCompoundWord,
} from "@/src/lib/chinese-db";

export async function GET() {
  await ensureCompoundTables();
  const data = await getCompoundWords();
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  await ensureCompoundTables();
  const { word, meaning, pinyin, hanViet, note, categoryIds } = await req.json();
  const created = await createCompoundWord(
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
  const { id, word, meaning, pinyin, hanViet, note, categoryIds } = await req.json();
  await updateCompoundWord(
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
  const { id } = await req.json();
  await deleteCompoundWord(id as number);
  return NextResponse.json({ ok: true });
}
