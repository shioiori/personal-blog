import { NextRequest, NextResponse } from "next/server";
import { getUserId, unauthorized } from "@/src/lib/auth";
import { ensureEssayTables, createDraft } from "@/src/lib/english-essay-db";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensureEssayTables();
  const { id } = await params;
  const draft = await createDraft(userId, parseInt(id, 10));
  if (!draft) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(draft, { status: 201 });
}
