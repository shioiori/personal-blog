import { NextRequest, NextResponse } from "next/server";
import { getUserId, unauthorized } from "@/src/lib/auth";
import { ensureEssayTables, listCategoryTerms } from "@/src/lib/english-essay-db";
import { normalizeEssayCategories } from "@/src/lib/essay-categories";
import { findTermMatches } from "@/src/lib/essay-highlight";

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  await ensureEssayTables();
  let body: { categories?: unknown; text?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const text = typeof body.text === "string" ? body.text : "";
  const terms = await listCategoryTerms(userId, normalizeEssayCategories(body.categories));
  return NextResponse.json({ matches: text && terms.length ? findTermMatches(text, terms) : [] });
}
