import { NextRequest, NextResponse } from "next/server";
import {
  ensureReviewHistoryTable,
  getReviewHistory,
  saveReviewHistory,
  deleteReviewHistory,
} from "@/src/lib/chinese-db";

export async function GET() {
  try {
    await ensureReviewHistoryTable();
    const history = await getReviewHistory(20);
    return NextResponse.json({ history });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureReviewHistoryTable();
    const { text, learnedCount } = await req.json() as { text: string; learnedCount: number };
    if (!text) return NextResponse.json({ error: "missing_text" }, { status: 400 });
    const item = await saveReviewHistory(text, learnedCount ?? 0);
    return NextResponse.json({ item });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json() as { id: number };
    await deleteReviewHistory(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
