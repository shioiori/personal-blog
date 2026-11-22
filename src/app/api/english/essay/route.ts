import { NextRequest, NextResponse } from "next/server";
import { getUserId, unauthorized } from "@/src/lib/auth";
import { ensureEssayTables, listEssays, createEssay } from "@/src/lib/english-essay-db";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensureEssayTables();
  return NextResponse.json(await listEssays(userId));
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensureEssayTables();
  let body: { title?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const essay = await createEssay(userId, title);
  return NextResponse.json(essay, { status: 201 });
}
