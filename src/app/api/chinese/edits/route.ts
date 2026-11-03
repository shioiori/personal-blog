import { NextRequest, NextResponse } from "next/server";
import { ensureTables, getCardEdits, upsertCardEdits } from "@/src/lib/chinese-db";
import type { UserEdits } from "@/src/components/chinese/study/EditCardModal";
import { getUserId, unauthorized } from "@/src/lib/auth";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  try {
    await ensureTables();
    const edits = await getCardEdits(userId);
    return NextResponse.json(edits);
  } catch (e) {
    console.error(e);
    return NextResponse.json({}, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  try {
    await ensureTables();
    const { char, edits } = await req.json() as { char: string; edits: UserEdits };
    if (!char || !edits) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }
    await upsertCardEdits(userId, char, edits);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }
}
