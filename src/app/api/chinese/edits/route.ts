import { NextRequest, NextResponse } from "next/server";
import { ensureTables, getCardEdits, upsertCardEdits } from "@/src/lib/chinese-db";
import type { UserEdits } from "@/src/components/chinese/EditCardModal";

export async function GET() {
  try {
    await ensureTables();
    const edits = await getCardEdits();
    return NextResponse.json(edits);
  } catch (e) {
    console.error(e);
    return NextResponse.json({}, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTables();
    const { char, edits } = await req.json() as { char: string; edits: UserEdits };
    if (!char || !edits) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }
    await upsertCardEdits(char, edits);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }
}
