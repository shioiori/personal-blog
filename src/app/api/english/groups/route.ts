import { NextRequest, NextResponse } from "next/server";
import { ensureEnglishTables, listGroups, createGroup } from "@/src/lib/english-db";

export async function GET() {
  await ensureEnglishTables();
  const groups = await listGroups();
  return NextResponse.json(groups);
}

export async function POST(req: NextRequest) {
  await ensureEnglishTables();
  const { name } = (await req.json()) as { name: string };
  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });
  const created = await createGroup(name.trim());
  return NextResponse.json(created);
}
