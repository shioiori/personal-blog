import { NextRequest, NextResponse } from "next/server";
import {
  deleteChineseUserText,
  ensureUserTextTable,
  getChineseUserTexts,
  saveChineseUserText,
  updateChineseUserText,
} from "@/src/lib/chinese-db";

export async function GET() {
  try {
    await ensureUserTextTable();
    const texts = await getChineseUserTexts();
    return NextResponse.json({ texts });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureUserTextTable();
    const { text, title } = (await req.json()) as { text?: string; title?: string };
    const normalizedText = text?.trim();
    if (!normalizedText) {
      return NextResponse.json({ error: "missing_text" }, { status: 400 });
    }

    const normalizedTitle = title?.trim() || undefined;
    const item = await saveChineseUserText(normalizedText, normalizedTitle);
    return NextResponse.json({ item });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    await ensureUserTextTable();
    const { id, text, title } = (await req.json()) as {
      id?: number;
      text?: string;
      title?: string;
    };
    const normalizedText = text?.trim();
    if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
    if (!normalizedText) {
      return NextResponse.json({ error: "missing_text" }, { status: 400 });
    }

    const normalizedTitle = title?.trim() || undefined;
    const item = await updateChineseUserText(id, normalizedText, normalizedTitle);
    if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureUserTextTable();
    const { id } = (await req.json()) as { id?: number };
    if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

    await deleteChineseUserText(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
