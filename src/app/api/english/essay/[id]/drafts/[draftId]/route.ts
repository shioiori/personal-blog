import { NextRequest, NextResponse } from "next/server";
import { getUserId, unauthorized } from "@/src/lib/auth";
import { ensureEssayTables, updateDraft, deleteDraft } from "@/src/lib/english-essay-db";

type Params = { params: Promise<{ id: string; draftId: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensureEssayTables();
  const { id, draftId } = await params;
  let body: { text?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (typeof body.text !== "string") return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const draft = await updateDraft(userId, parseInt(id, 10), parseInt(draftId, 10), body.text);
  if (!draft) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(draft);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensureEssayTables();
  const { id, draftId } = await params;
  const ok = await deleteDraft(userId, parseInt(id, 10), parseInt(draftId, 10));
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
