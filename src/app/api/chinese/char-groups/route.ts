import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/src/lib/db";
import {
  ensureCharGroupTables,
  ensureTables,
  getCharGroups,
  createCharGroup,
  deleteCharGroup,
  addCharsToGroup,
  removeCharFromGroup,
  upsertCardState,
} from "@/src/lib/chinese-db";

export async function GET() {
  await ensureCharGroupTables();
  const data = await getCharGroups();
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  await ensureCharGroupTables();
  const body = await req.json() as { name?: string; groupId?: number; chars?: string[]; char?: string; action?: string };
  if (body.action === "addChars") {
    await addCharsToGroup(body.groupId!, body.chars!);
    await ensureTables();
    await Promise.all(body.chars!.map((char) => upsertCardState(char, true)));
    return NextResponse.json({ ok: true });
  }
  if (body.action === "removeChar") {
    await removeCharFromGroup(body.groupId!, body.char!);
    return NextResponse.json({ ok: true });
  }
  const created = await createCharGroup(body.name!);
  return NextResponse.json(created);
}

export async function PUT(req: NextRequest) {
  const { id, name } = await req.json() as { id: number; name: string };
  await sql`UPDATE char_groups SET name = ${name} WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json() as { id: number };
  await deleteCharGroup(id);
  return NextResponse.json({ ok: true });
}
