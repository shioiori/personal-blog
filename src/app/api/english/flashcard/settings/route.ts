import { NextRequest, NextResponse } from "next/server";
import { ensureEnglishTables, getEnglishSetting, upsertEnglishSetting } from "@/src/lib/english-db";
import { getUserId, unauthorized } from "@/src/lib/auth";

const KEY = "flashcard";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  try {
    await ensureEnglishTables();
    const value = await getEnglishSetting(userId, KEY);
    return NextResponse.json({ value });
  } catch (e) {
    console.error("[GET english/flashcard/settings error]", e);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  try {
    await ensureEnglishTables();
    const { value } = (await req.json()) as { value: unknown };
    if (!value || typeof value !== "object") return NextResponse.json({ error: "invalid" }, { status: 400 });
    await upsertEnglishSetting(userId, KEY, value);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[PUT english/flashcard/settings error]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
