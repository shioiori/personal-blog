import { NextResponse } from "next/server";
import { ensureEnglishTables, syncReverseLinks } from "@/src/lib/english-db";
import { getUserId, unauthorized } from "@/src/lib/auth";

export async function POST() {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensureEnglishTables();
  return NextResponse.json({ updated: await syncReverseLinks(userId) });
}
