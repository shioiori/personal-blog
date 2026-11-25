import { sql, once } from "./db";
import type { Essay, EssayPart, EssaySummary, EssayStep } from "@/src/declaration/english";
import { defaultEssayParts } from "./essay-format";
import { LEGACY_CATEGORY_REMAP, normalizeEssayCategories, type EssayCategory } from "./essay-categories";

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
  await sql`ALTER TABLE english_essay ADD COLUMN IF NOT EXISTS categories TEXT[] NOT NULL DEFAULT '{}'`;
  await sql`ALTER TABLE english_essay ADD COLUMN IF NOT EXISTS done BOOLEAN NOT NULL DEFAULT FALSE`;
  // One-time move from the earlier single-value "category" column, then drop it so
  // it can't resurface after a user clears an essay's categories.
  await sql`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'english_essay' AND column_name = 'category') THEN
        UPDATE english_essay SET categories = ARRAY[category] WHERE category IS NOT NULL AND cardinality(categories) = 0;
        ALTER TABLE english_essay DROP COLUMN category;
      END IF;
    END $$
  `;
  // Ids from the earlier topic list → their replacement in the current one.
  for (const [from, to] of Object.entries(LEGACY_CATEGORY_REMAP)) {
    await sql`UPDATE english_essay SET categories = array_replace(categories, ${from}, ${to}) WHERE ${from} = ANY(categories)`;
  }
});

function toSummary(r: Record<string, unknown>): EssaySummary {
  return {
    id: r.id as number,
    title: r.title as string,
    categories: normalizeEssayCategories(r.categories),
    step: r.step as EssayStep,
    done: r.done as boolean,
    createdAt: (r.created_at as Date).toISOString(),
    updatedAt: (r.updated_at as Date).toISOString(),
  };
}

function toEssay(r: Record<string, unknown>): Essay {
  return {
    id: r.id as number,
    title: r.title as string,
    categories: normalizeEssayCategories(r.categories),
    parts: r.parts as EssayPart[],
    step: r.step as EssayStep,
    finalText: (r.final_text as string | null) ?? "",
    done: r.done as boolean,
    createdAt: (r.created_at as Date).toISOString(),
    updatedAt: (r.updated_at as Date).toISOString(),
  };
}

export async function listEssays(userId: number): Promise<EssaySummary[]> {
  const rows = await sql`
    SELECT id, title, categories, step, done, created_at, updated_at FROM english_essay
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
  patch: { title?: string; categories?: EssayCategory[]; parts?: EssayPart[]; step?: EssayStep; finalText?: string; done?: boolean },
): Promise<Essay | null> {
  const existing = await getEssay(userId, id);
  if (!existing) return null;
  const title = patch.title ?? existing.title;
  const categories = patch.categories ?? existing.categories;
  const parts = patch.parts ?? existing.parts;
  const step = patch.step ?? existing.step;
  const finalText = patch.finalText ?? existing.finalText;
  const done = patch.done ?? existing.done;
  const partsJson = JSON.stringify(parts);
  const rows = await sql`
    UPDATE english_essay SET title = ${title}, categories = ${categories}, parts = ${partsJson}::jsonb, step = ${step}, final_text = ${finalText}, done = ${done},
      updated_at = CASE
        WHEN (title, categories, parts, step, final_text) IS DISTINCT FROM (${title}::text, ${categories}::text[], ${partsJson}::jsonb, ${step}::text, ${finalText}::text) THEN NOW()
        ELSE updated_at
      END
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING *
  `;
  return rows[0] ? toEssay(rows[0]) : null;
}

export async function deleteEssay(userId: number, id: number): Promise<boolean> {
  const rows = await sql`DELETE FROM english_essay WHERE id = ${id} AND user_id = ${userId} RETURNING id`;
  return !!rows[0];
}
