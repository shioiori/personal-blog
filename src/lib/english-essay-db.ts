import { sql, once } from "./db";
import { ensureEnglishTables } from "./english-db";
import type { Essay, EssayCategoryGroups, EssayDraft, EssaySummary } from "@/src/declaration/english";
import { joinLegacyEssayText, type LegacyEssayPart } from "./essay-format";
import { LEGACY_CATEGORY_REMAP, normalizeEssayCategories, type EssayCategory } from "./essay-categories";

export const ensureEssayTables = once(async function ensureEssayTables() {
  await ensureEnglishTables();
  await sql`
    CREATE TABLE IF NOT EXISTS english_essay (
      id         SERIAL PRIMARY KEY,
      user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title      TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
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
  await sql`
    CREATE TABLE IF NOT EXISTS english_essay_draft (
      id         SERIAL PRIMARY KEY,
      essay_id   INT NOT NULL REFERENCES english_essay(id) ON DELETE CASCADE,
      text       TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS english_essay_draft_essay_id_idx ON english_essay_draft (essay_id)`;
  await sql`
    CREATE TABLE IF NOT EXISTS english_essay_category_group (
      user_id  INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      group_id INT  NOT NULL REFERENCES english_word_groups(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, category, group_id)
    )
  `;
  const legacy = await sql`SELECT 1 FROM information_schema.columns WHERE table_name = 'english_essay' AND column_name = 'parts'`;
  if (legacy[0]) {
    const rows = await sql`
      SELECT e.id, e.parts, e.final_text, e.created_at, e.updated_at FROM english_essay e
      WHERE NOT EXISTS (SELECT 1 FROM english_essay_draft d WHERE d.essay_id = e.id)
    `;
    for (const r of rows) {
      const finalText = (r.final_text as string | null) ?? "";
      const text = finalText.trim() ? finalText : joinLegacyEssayText((r.parts as LegacyEssayPart[] | null) ?? []);
      await sql`
        INSERT INTO english_essay_draft (essay_id, text, created_at, updated_at)
        VALUES (${r.id}, ${text}, ${r.created_at}, ${r.updated_at})
      `;
    }
    await sql`ALTER TABLE english_essay DROP COLUMN IF EXISTS parts, DROP COLUMN IF EXISTS step, DROP COLUMN IF EXISTS final_text`;
  }
});

function toSummary(r: Record<string, unknown>): EssaySummary {
  return {
    id: r.id as number,
    title: r.title as string,
    categories: normalizeEssayCategories(r.categories),
    done: r.done as boolean,
    createdAt: (r.created_at as Date).toISOString(),
    updatedAt: (r.updated_at as Date).toISOString(),
  };
}

function toDraft(r: Record<string, unknown>): EssayDraft {
  return {
    id: r.id as number,
    text: r.text as string,
    createdAt: (r.created_at as Date).toISOString(),
    updatedAt: (r.updated_at as Date).toISOString(),
  };
}

export async function listEssays(userId: number): Promise<EssaySummary[]> {
  const rows = await sql`
    SELECT id, title, categories, done, created_at, updated_at FROM english_essay
    WHERE user_id = ${userId} ORDER BY updated_at DESC
  `;
  return rows.map(toSummary);
}

export async function getEssay(userId: number, id: number): Promise<Essay | null> {
  const rows = await sql`SELECT * FROM english_essay WHERE id = ${id} AND user_id = ${userId}`;
  if (!rows[0]) return null;
  const drafts = await sql`SELECT * FROM english_essay_draft WHERE essay_id = ${id} ORDER BY created_at ASC, id ASC`;
  return { ...toSummary(rows[0]), drafts: drafts.map(toDraft) };
}

export async function createEssay(userId: number, title: string): Promise<Essay> {
  const rows = await sql`INSERT INTO english_essay (user_id, title) VALUES (${userId}, ${title}) RETURNING *`;
  const drafts = await sql`INSERT INTO english_essay_draft (essay_id) VALUES (${rows[0].id}) RETURNING *`;
  return { ...toSummary(rows[0]), drafts: drafts.map(toDraft) };
}

export async function updateEssay(
  userId: number,
  id: number,
  patch: { title?: string; categories?: EssayCategory[]; done?: boolean },
): Promise<EssaySummary | null> {
  const rows = await sql`
    UPDATE english_essay SET
      title = COALESCE(${patch.title ?? null}::text, title),
      categories = COALESCE(${patch.categories ?? null}::text[], categories),
      done = COALESCE(${patch.done ?? null}::boolean, done),
      updated_at = CASE
        WHEN (title, categories) IS DISTINCT FROM (COALESCE(${patch.title ?? null}::text, title), COALESCE(${patch.categories ?? null}::text[], categories)) THEN NOW()
        ELSE updated_at
      END
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING *
  `;
  return rows[0] ? toSummary(rows[0]) : null;
}

export async function deleteEssay(userId: number, id: number): Promise<boolean> {
  const rows = await sql`DELETE FROM english_essay WHERE id = ${id} AND user_id = ${userId} RETURNING id`;
  return !!rows[0];
}

export async function createDraft(userId: number, essayId: number): Promise<EssayDraft | null> {
  const rows = await sql`
    INSERT INTO english_essay_draft (essay_id)
    SELECT id FROM english_essay WHERE id = ${essayId} AND user_id = ${userId}
    RETURNING *
  `;
  return rows[0] ? toDraft(rows[0]) : null;
}

export async function updateDraft(userId: number, essayId: number, draftId: number, text: string): Promise<EssayDraft | null> {
  const rows = await sql`
    WITH d AS (
      UPDATE english_essay_draft SET text = ${text}, updated_at = NOW()
      WHERE id = ${draftId} AND essay_id = ${essayId}
        AND EXISTS (SELECT 1 FROM english_essay WHERE id = ${essayId} AND user_id = ${userId})
      RETURNING *
    ), e AS (
      UPDATE english_essay SET updated_at = NOW() WHERE id IN (SELECT essay_id FROM d)
    )
    SELECT * FROM d
  `;
  return rows[0] ? toDraft(rows[0]) : null;
}

export async function deleteDraft(userId: number, essayId: number, draftId: number): Promise<boolean> {
  const rows = await sql`
    DELETE FROM english_essay_draft
    WHERE id = ${draftId} AND essay_id = ${essayId}
      AND EXISTS (SELECT 1 FROM english_essay WHERE id = ${essayId} AND user_id = ${userId})
      AND (SELECT COUNT(*) FROM english_essay_draft WHERE essay_id = ${essayId}) > 1
    RETURNING id
  `;
  return !!rows[0];
}

export async function listCategoryGroups(userId: number): Promise<EssayCategoryGroups> {
  const rows = await sql`
    SELECT category, array_agg(group_id ORDER BY group_id) AS group_ids FROM english_essay_category_group
    WHERE user_id = ${userId} GROUP BY category
  `;
  return Object.fromEntries(rows.map((r) => [r.category as string, r.group_ids as number[]]));
}

export async function setCategoryGroups(userId: number, category: EssayCategory, groupIds: number[]): Promise<number[]> {
  await sql`DELETE FROM english_essay_category_group WHERE user_id = ${userId} AND category = ${category}`;
  if (groupIds.length === 0) return [];
  const rows = await sql`
    INSERT INTO english_essay_category_group (user_id, category, group_id)
    SELECT ${userId}, ${category}, id FROM english_word_groups WHERE user_id = ${userId} AND id = ANY(${groupIds}::int[])
    RETURNING group_id
  `;
  return rows.map((r) => r.group_id as number).sort((a, b) => a - b);
}

export async function listCategoryTerms(userId: number, categories: EssayCategory[]): Promise<string[]> {
  if (categories.length === 0) return [];
  const rows = await sql`
    SELECT DISTINCT w.word, w.alt_spelling, o.word AS origin_word, o.alt_spelling AS origin_alt
    FROM english_essay_category_group cg
    JOIN english_word_group_members m ON m.group_id = cg.group_id
    JOIN english_words w ON w.id = m.word_id
    LEFT JOIN english_words o ON o.id = w.origin_word_id
    WHERE cg.user_id = ${userId} AND cg.category = ANY(${categories}::text[])
  `;
  const terms = new Set<string>();
  for (const r of rows) {
    for (const v of [r.word, r.alt_spelling, r.origin_word, r.origin_alt] as (string | null)[]) {
      for (const t of v?.split(/[,;/]/) ?? []) if (t.trim()) terms.add(t.trim());
    }
  }
  return [...terms];
}
