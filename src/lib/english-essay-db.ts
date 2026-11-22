import { sql, once } from "./db";
import type { Essay, EssayPart, EssaySummary, EssayStep } from "@/src/declaration/english";
import { defaultEssayParts } from "./essay-format";

export const ensureEssayTables = once(async function ensureEssayTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS english_essay (
      id         SERIAL PRIMARY KEY,
      user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title      TEXT NOT NULL DEFAULT '',
      parts      JSONB NOT NULL,
      step       TEXT NOT NULL DEFAULT 'outline',
      final_text TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE english_essay ADD COLUMN IF NOT EXISTS final_text TEXT NOT NULL DEFAULT ''`;
});

function toSummary(r: Record<string, unknown>): EssaySummary {
  return {
    id: r.id as number,
    title: r.title as string,
    step: r.step as EssayStep,
    createdAt: (r.created_at as Date).toISOString(),
    updatedAt: (r.updated_at as Date).toISOString(),
  };
}

function toEssay(r: Record<string, unknown>): Essay {
  return {
    id: r.id as number,
    title: r.title as string,
    parts: r.parts as EssayPart[],
    step: r.step as EssayStep,
    finalText: (r.final_text as string | null) ?? "",
    createdAt: (r.created_at as Date).toISOString(),
    updatedAt: (r.updated_at as Date).toISOString(),
  };
}

export async function listEssays(userId: number): Promise<EssaySummary[]> {
  const rows = await sql`
    SELECT id, title, step, created_at, updated_at FROM english_essay
    WHERE user_id = ${userId} ORDER BY updated_at DESC
  `;
  return rows.map(toSummary);
}

export async function getEssay(userId: number, id: number): Promise<Essay | null> {
  const rows = await sql`SELECT * FROM english_essay WHERE id = ${id} AND user_id = ${userId}`;
  return rows[0] ? toEssay(rows[0]) : null;
}

export async function createEssay(userId: number, title: string): Promise<Essay> {
  const parts = defaultEssayParts();
  const rows = await sql`
    INSERT INTO english_essay (user_id, title, parts, step)
    VALUES (${userId}, ${title}, ${JSON.stringify(parts)}::jsonb, 'outline')
    RETURNING *
  `;
  return toEssay(rows[0]);
}

export async function updateEssay(
  userId: number,
  id: number,
  patch: { title?: string; parts?: EssayPart[]; step?: EssayStep; finalText?: string },
): Promise<Essay | null> {
  const existing = await getEssay(userId, id);
  if (!existing) return null;
  const title = patch.title ?? existing.title;
  const parts = patch.parts ?? existing.parts;
  const step = patch.step ?? existing.step;
  const finalText = patch.finalText ?? existing.finalText;
  const rows = await sql`
    UPDATE english_essay SET title = ${title}, parts = ${JSON.stringify(parts)}::jsonb, step = ${step}, final_text = ${finalText}, updated_at = NOW()
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING *
  `;
  return rows[0] ? toEssay(rows[0]) : null;
}

export async function deleteEssay(userId: number, id: number): Promise<boolean> {
  const rows = await sql`DELETE FROM english_essay WHERE id = ${id} AND user_id = ${userId} RETURNING id`;
  return !!rows[0];
}
