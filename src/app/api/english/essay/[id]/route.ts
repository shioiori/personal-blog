import { NextRequest, NextResponse } from "next/server";
import { getUserId, unauthorized } from "@/src/lib/auth";
import { ensureEssayTables, getEssay, updateEssay, deleteEssay } from "@/src/lib/english-essay-db";
import type { EssayPart, EssayStep } from "@/src/declaration/english";
import { normalizeEssayCategories } from "@/src/lib/essay-categories";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensureEssayTables();
  const { id } = await params;
  const essay = await getEssay(userId, parseInt(id, 10));
  if (!essay) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(essay);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensureEssayTables();
  const { id } = await params;

  let body: { title?: unknown; categories?: unknown; parts?: unknown; step?: unknown; finalText?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const title = typeof body.title === "string" ? body.title : undefined;
  // Unknown ids are dropped; an empty array clears the categories.
  const categories = Array.isArray(body.categories) ? normalizeEssayCategories(body.categories) : undefined;
  const parts = Array.isArray(body.parts) ? (body.parts as EssayPart[]) : undefined;
  const step = typeof body.step === "string" ? (body.step as EssayStep) : undefined;
  const finalText = typeof body.finalText === "string" ? body.finalText : undefined;

  const essay = await updateEssay(userId, parseInt(id, 10), { title, categories, parts, step, finalText });
  if (!essay) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(essay);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensureEssayTables();
  const { id } = await params;
  await deleteEssay(userId, parseInt(id, 10));
  return NextResponse.json({ ok: true });
}
