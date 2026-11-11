import { NextRequest, NextResponse } from "next/server";
import { getUserId, unauthorized } from "@/src/lib/auth";
import {
  deleteScript,
  ensureGapFillTables,
  getScript,
  normalizeScriptName,
  normalizeSource,
  updateScriptName,
  updateScriptSource,
} from "@/src/lib/english-gapfill-db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensureGapFillTables();
  const { id } = await params;
  const script = await getScript(userId, parseInt(id, 10));
  if (!script) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ script });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensureGapFillTables();
  const { id } = await params;
  const scriptId = parseInt(id, 10);
  const body = (await req.json()) as { source?: unknown; name?: unknown };
  if ("name" in body) {
    const name = normalizeScriptName(body.name);
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
    await updateScriptName(userId, scriptId, name);
    return NextResponse.json({ name });
  }
  const source = normalizeSource(body.source);
  await updateScriptSource(userId, scriptId, source);
  return NextResponse.json({ source });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensureGapFillTables();
  const { id } = await params;
  await deleteScript(userId, parseInt(id, 10));
  return NextResponse.json({ ok: true });
}
