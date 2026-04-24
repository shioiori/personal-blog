import { NextRequest, NextResponse } from "next/server";
import { ensureTables, getCardEdits, upsertCardEdits } from "@/src/lib/chinese-db";
import type { UserEdits } from "@/src/components/chinese/EditCardModal";

function getSession(req: NextRequest): string {
  return req.cookies.get("chinese_session")?.value ?? crypto.randomUUID();
}

export async function GET(req: NextRequest) {
  try {
    await ensureTables();
    const sessionId = getSession(req);
    const edits = await getCardEdits(sessionId);
    const res = NextResponse.json(edits);
    res.cookies.set("chinese_session", sessionId, { path: "/", maxAge: 60 * 60 * 24 * 365 });
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json({}, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTables();
    const sessionId = getSession(req);
    const { char, edits } = await req.json() as { char: string; edits: UserEdits };
    if (!char || !edits) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }
    await upsertCardEdits(sessionId, char, edits);
    const res = NextResponse.json({ ok: true });
    res.cookies.set("chinese_session", sessionId, { path: "/", maxAge: 60 * 60 * 24 * 365 });
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }
}
