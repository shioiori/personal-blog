import { NextResponse } from "next/server";
import {
  ensureGrammarTables,
  getGrammarPosts,
  createGrammarPost,
  updateGrammarPost,
  deleteGrammarPost,
} from "@/src/lib/chinese-db";
import { getUserId, unauthorized } from "@/src/lib/auth";

async function init() {
  await ensureGrammarTables();
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await init();
  const posts = await getGrammarPosts(userId);
  return NextResponse.json(posts);
}

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await init();
  const { title, content } = (await req.json()) as { title: string; content: string };
  if (!title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 });
  const post = await createGrammarPost(userId, title.trim(), content ?? "");
  return NextResponse.json(post);
}

export async function PUT(req: Request) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await init();
  const { id, title, content } = (await req.json()) as { id: number; title: string; content: string };
  if (!id || !title?.trim()) return NextResponse.json({ error: "id and title required" }, { status: 400 });
  await updateGrammarPost(userId, id, title.trim(), content ?? "");
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await init();
  const { id } = (await req.json()) as { id: number };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteGrammarPost(userId, id);
  return NextResponse.json({ ok: true });
}
