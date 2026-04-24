import { NextRequest, NextResponse } from "next/server";
import { ensureTables, getCardStates, upsertCardState } from "@/src/lib/chinese-db";

// Simple session: use a cookie "chinese_session", create if absent
function getSession(req: NextRequest): string {
  return req.cookies.get("chinese_session")?.value ?? crypto.randomUUID();
}

export async function GET(req: NextRequest) {
  try {
    await ensureTables();
    const sessionId = getSession(req);
    const states = await getCardStates(sessionId);
    const res = NextResponse.json(states);
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
    const { char, hidden } = await req.json() as { char: string; hidden: boolean };
    if (!char || typeof hidden !== "boolean") {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }
    await upsertCardState(sessionId, char, hidden);
    const res = NextResponse.json({ ok: true });
    res.cookies.set("chinese_session", sessionId, { path: "/", maxAge: 60 * 60 * 24 * 365 });
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }
}
