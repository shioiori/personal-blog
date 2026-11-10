import { NextRequest, NextResponse } from "next/server";
import { getUserId, unauthorized } from "@/src/lib/auth";
import { ensureGapFillTables, submitAttempt } from "@/src/lib/english-gapfill-db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensureGapFillTables();
  const { id } = await params;
  const { responses } = (await req.json()) as { responses?: unknown };
  if (!Array.isArray(responses)) return NextResponse.json({ error: "responses is required" }, { status: 400 });
  const result = await submitAttempt(userId, parseInt(id, 10), responses.map((r) => String(r ?? "")));
  if (!result) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(result);
}
