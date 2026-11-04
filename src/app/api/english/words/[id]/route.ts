import { NextRequest, NextResponse } from "next/server";
import { ensureEnglishTables, getWord, updateWord, deleteWord, type SenseInput } from "@/src/lib/english-db";
import { getUserId, unauthorized } from "@/src/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensureEnglishTables();
  const { id } = await params;
  const word = await getWord(userId, parseInt(id, 10));
  if (!word) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(word);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensureEnglishTables();
  const { id } = await params;
  const wordId = parseInt(id, 10);
  const body = (await req.json()) as { word: string; senses?: SenseInput[]; relatedWords?: string | null; altSpelling?: string | null };
  if (!body.word?.trim()) {
    return NextResponse.json({ error: "word is required" }, { status: 400 });
  }
  if (!(await updateWord(userId, wordId, body.word.trim(), body.senses ?? [], body.relatedWords, body.altSpelling))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const updated = await getWord(userId, wordId);
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensureEnglishTables();
  const { id } = await params;
  await deleteWord(userId, parseInt(id, 10));
  return NextResponse.json({ ok: true });
}
