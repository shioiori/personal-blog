import { NextRequest, NextResponse } from "next/server";
import { ensureTables, getCardStates, upsertCardState } from "@/src/lib/chinese-db";

export async function GET() {
  try {
    await ensureTables();
    const states = await getCardStates();
    return NextResponse.json(states);
  } catch (e) {
    console.error(e);
    return NextResponse.json({}, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTables();
    const { char, hidden } = await req.json() as { char: string; hidden: boolean };
    if (!char || typeof hidden !== "boolean") {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }
    await upsertCardState(char, hidden);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }
}
