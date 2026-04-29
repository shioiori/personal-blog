import { NextResponse } from "next/server";
import {
  ensureGrammarTables,
  getGrammarPosts,
  createGrammarPost,
  updateGrammarPost,
  deleteGrammarPost,
} from "@/src/lib/chinese-db";

async function init() {
  await ensureGrammarTables();
}

export async function GET() {
  await init();
  const posts = await getGrammarPosts();
  return NextResponse.json(posts);
}

export async function POST(req: Request) {
  await init();
  const { title, content } = (await req.json()) as { title: string; content: string };
  if (!title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 });
  const post = await createGrammarPost(title.trim(), content ?? "");
  return NextResponse.json(post);
}

export async function PUT(req: Request) {
  await init();
  const { id, title, content } = (await req.json()) as { id: number; title: string; content: string };
  if (!id || !title?.trim()) return NextResponse.json({ error: "id and title required" }, { status: 400 });
  await updateGrammarPost(id, title.trim(), content ?? "");
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  await init();
  const { id } = (await req.json()) as { id: number };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteGrammarPost(id);
  return NextResponse.json({ ok: true });
}
