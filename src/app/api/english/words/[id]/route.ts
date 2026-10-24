import { NextRequest, NextResponse } from "next/server";
import { ensureEnglishTables, getWord, updateWord, deleteWord, type SenseInput } from "@/src/lib/english-db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureEnglishTables();
  const { id } = await params;
  const word = await getWord(parseInt(id, 10));
  if (!word) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(word);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureEnglishTables();
  const { id } = await params;
  const wordId = parseInt(id, 10);
  const body = (await req.json()) as { word: string; senses?: SenseInput[] };
  if (!body.word?.trim()) {
    return NextResponse.json({ error: "word is required" }, { status: 400 });
  }
  await updateWord(wordId, body.word.trim(), body.senses ?? []);
  const updated = await getWord(wordId);
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureEnglishTables();
  const { id } = await params;
  await deleteWord(parseInt(id, 10));
  return NextResponse.json({ ok: true });
}
