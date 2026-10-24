import { NextRequest, NextResponse } from "next/server";
import { ensureEnglishTables, addWordsToGroup, removeWordFromGroup } from "@/src/lib/english-db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureEnglishTables();
  const { id } = await params;
  const { wordIds } = (await req.json()) as { wordIds: number[] };
  if (!Array.isArray(wordIds) || wordIds.length === 0) {
    return NextResponse.json({ error: "wordIds required" }, { status: 400 });
  }
  await addWordsToGroup(parseInt(id, 10), wordIds);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureEnglishTables();
  const { id } = await params;
  const { wordId } = (await req.json()) as { wordId: number };
  await removeWordFromGroup(parseInt(id, 10), wordId);
  return NextResponse.json({ ok: true });
}
