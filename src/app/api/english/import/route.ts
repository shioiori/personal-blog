import { NextRequest, NextResponse } from "next/server";
import { ensureEnglishTables, bulkImportWords, createGroup, addWordsToGroup, listGroups } from "@/src/lib/english-db";
import type { ImportWordInput } from "@/src/declaration/english";
import { getUserId, unauthorized } from "@/src/lib/auth";

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  try {
    await ensureEnglishTables();
    const body = (await req.json()) as {
      items: ImportWordInput[];
      groupId?: number;
      newGroupName?: string;
      onDuplicate?: "skip" | "overwrite";
    };
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "items required" }, { status: 400 });
    }

    let groupId = body.groupId;
    if (!groupId && body.newGroupName?.trim()) {
      const groups = await listGroups(userId);
      const existing = groups.find((g) => g.name.toLowerCase() === body.newGroupName!.trim().toLowerCase());
      groupId = existing ? existing.id : (await createGroup(userId, body.newGroupName.trim())).id;
    }

    const { created, overwritten, skipped } = await bulkImportWords(userId, body.items, groupId, body.onDuplicate ?? "skip");
    return NextResponse.json({ created, overwritten, skippedWords: skipped });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[POST english/import error]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Export helper unused directly but kept for symmetry with group word-add flow
export async function PUT(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  try {
    const { groupId, wordIds } = (await req.json()) as { groupId: number; wordIds: number[] };
    await addWordsToGroup(userId, groupId, wordIds);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
