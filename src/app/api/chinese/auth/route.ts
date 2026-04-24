import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { key } = await req.json() as { key?: string };
  const correct = process.env.CHINESE_EDIT_KEY;
  if (!correct) {
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }
  const ok = key === correct;
  return NextResponse.json({ ok });
}
