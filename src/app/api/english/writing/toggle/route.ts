import { NextRequest, NextResponse } from "next/server";
import { ensureEnglishTables } from "@/src/lib/english-db";
import { ensureWritingTables, getWritingActiveOverrides, setWritingActive } from "@/src/lib/english-writing-db";
import { getUserId, unauthorized } from "@/src/lib/auth";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  try {
    await ensureEnglishTables();
    await ensureWritingTables();
    return NextResponse.json({ overrides: await getWritingActiveOverrides(userId) });
  } catch (e) {
    console.error("[GET english/writing/toggle error]", e);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  try {
    await ensureEnglishTables();
    await ensureWritingTables();
    const { wordIds, active } = (await req.json()) as { wordIds: number[]; active: boolean };
    if (!Array.isArray(wordIds) || wordIds.length === 0) return NextResponse.json({ error: "wordIds required" }, { status: 400 });
    await setWritingActive(userId, wordIds, !!active);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[POST english/writing/toggle error]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
