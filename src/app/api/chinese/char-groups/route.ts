import { NextRequest, NextResponse } from "next/server";
import {
  ensureCharGroupTables,
  ensureTables,
  getCharGroups,
  createCharGroup,
  renameCharGroup,
  deleteCharGroup,
  addCharsToGroup,
  removeCharFromGroup,
  upsertCardState,
} from "@/src/lib/chinese-db";
import { getUserId, unauthorized } from "@/src/lib/auth";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensureCharGroupTables();
  const data = await getCharGroups(userId);
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensureCharGroupTables();
  const body = await req.json() as { name?: string; groupId?: number; chars?: string[]; char?: string; action?: string };
  if (body.action === "addChars") {
    if (!(await addCharsToGroup(userId, body.groupId!, body.chars!))) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    await ensureTables();
    await Promise.all(body.chars!.map((char) => upsertCardState(userId, char, true)));
    return NextResponse.json({ ok: true });
  }
  if (body.action === "removeChar") {
    await removeCharFromGroup(userId, body.groupId!, body.char!);
    return NextResponse.json({ ok: true });
  }
  const created = await createCharGroup(userId, body.name!);
  return NextResponse.json(created);
}

export async function PUT(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  const { id, name } = await req.json() as { id: number; name: string };
  await renameCharGroup(userId, id, name);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  const { id } = await req.json() as { id: number };
  await deleteCharGroup(userId, id);
  return NextResponse.json({ ok: true });
}
