import { sql } from "./db";
import type { UserEdits } from "@/src/components/chinese/EditCardModal";
import type { CompoundCategory, CompoundWord } from "@/src/declaration/chinese";

export async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS chinese_card_state (
      char       TEXT NOT NULL PRIMARY KEY,
      hidden     BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS chinese_card_edits (
      char        TEXT NOT NULL PRIMARY KEY,
      pinyin      TEXT,
      han_viet    TEXT,
      meaning_vi  TEXT,
      note        TEXT,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS chinese_daily_limit (
      date_key   DATE NOT NULL PRIMARY KEY,
      count      INT  NOT NULL DEFAULT 0
    )
  `;
}

// ── Daily rate limit ─────────────────────────────────────────────────────────

// Check current usage without modifying. Returns used count today.
export async function getDailyUsage(): Promise<number> {
  const rows = await sql`
    SELECT count FROM chinese_daily_limit WHERE date_key = CURRENT_DATE
  `;
  return (rows[0]?.count as number) ?? 0;
}

// Call only after a successful generate. Creates today's record (count=1) or increments it.
export async function incrementDailyLimit(): Promise<void> {
  await sql`
    INSERT INTO chinese_daily_limit (date_key, count)
    VALUES (CURRENT_DATE, 1)
    ON CONFLICT (date_key)
    DO UPDATE SET count = chinese_daily_limit.count + 1
  `;
}

// ── Card state (hidden/visible) ──────────────────────────────────────────────

export async function getCardStates(): Promise<Record<string, boolean>> {
  const rows = await sql`SELECT char, hidden FROM chinese_card_state`;
  return Object.fromEntries(rows.map((r) => [r.char, r.hidden]));
}

export async function upsertCardState(char: string, hidden: boolean) {
  await sql`
    INSERT INTO chinese_card_state (char, hidden, updated_at)
    VALUES (${char}, ${hidden}, NOW())
    ON CONFLICT (char)
    DO UPDATE SET hidden = EXCLUDED.hidden, updated_at = NOW()
  `;
}

// ── Card edits (user annotations) ────────────────────────────────────────────

export async function getCardEdits(): Promise<Record<string, UserEdits>> {
  const rows = await sql`
    SELECT char, pinyin, han_viet, meaning_vi, note FROM chinese_card_edits
  `;
  return Object.fromEntries(
    rows.map((r) => [
      r.char,
      {
        pinyin: r.pinyin ?? undefined,
        hanViet: r.han_viet ?? undefined,
        meaningVi: r.meaning_vi ?? undefined,
        note: r.note ?? undefined,
      } satisfies UserEdits,
    ])
  );
}

// ── Compound words ────────────────────────────────────────────────────────────

export async function ensureCompoundTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS compound_categories (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS compound_words (
      id         SERIAL PRIMARY KEY,
      word       TEXT NOT NULL,
      meaning    TEXT NOT NULL DEFAULT '',
      pinyin     TEXT NOT NULL DEFAULT '',
      han_viet   TEXT NOT NULL DEFAULT '',
      note       TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    ALTER TABLE compound_words ADD COLUMN IF NOT EXISTS note TEXT NOT NULL DEFAULT ''
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS compound_word_categories (
      word_id     INT NOT NULL REFERENCES compound_words(id) ON DELETE CASCADE,
      category_id INT NOT NULL REFERENCES compound_categories(id) ON DELETE CASCADE,
      PRIMARY KEY (word_id, category_id)
    )
  `;
}

export async function getCompoundCategories(): Promise<CompoundCategory[]> {
  const rows = await sql`SELECT id, name FROM compound_categories ORDER BY name`;
  return rows.map((r) => ({ id: r.id as number, name: r.name as string }));
}

export async function createCompoundCategory(name: string): Promise<CompoundCategory> {
  const rows = await sql`
    INSERT INTO compound_categories (name) VALUES (${name}) RETURNING id, name
  `;
  return { id: rows[0].id as number, name: rows[0].name as string };
}

export async function updateCompoundCategory(id: number, name: string): Promise<void> {
  await sql`UPDATE compound_categories SET name = ${name} WHERE id = ${id}`;
}

export async function deleteCompoundCategory(id: number): Promise<void> {
  await sql`DELETE FROM compound_categories WHERE id = ${id}`;
}

export async function getCompoundWords(): Promise<CompoundWord[]> {
  const rows = await sql`
    SELECT w.id, w.word, w.meaning, w.pinyin, w.han_viet, w.note,
           COALESCE(array_agg(wc.category_id) FILTER (WHERE wc.category_id IS NOT NULL), '{}') AS category_ids
    FROM compound_words w
    LEFT JOIN compound_word_categories wc ON w.id = wc.word_id
    GROUP BY w.id
    ORDER BY w.id
  `;
  return rows.map((r) => ({
    id: r.id as number,
    word: r.word as string,
    meaning: r.meaning as string,
    pinyin: r.pinyin as string,
    hanViet: r.han_viet as string,
    note: (r.note as string) ?? "",
    categoryIds: (r.category_ids as number[]) ?? [],
  }));
}

export async function createCompoundWord(
  word: string, meaning: string, pinyin: string, hanViet: string, note: string, categoryIds: number[]
): Promise<CompoundWord> {
  const rows = await sql`
    INSERT INTO compound_words (word, meaning, pinyin, han_viet, note)
    VALUES (${word}, ${meaning}, ${pinyin}, ${hanViet}, ${note})
    RETURNING id, word, meaning, pinyin, han_viet, note
  `;
  const id = rows[0].id as number;
  if (categoryIds.length > 0) {
    for (const cid of categoryIds) {
      await sql`INSERT INTO compound_word_categories (word_id, category_id) VALUES (${id}, ${cid}) ON CONFLICT DO NOTHING`;
    }
  }
  return { id, word: rows[0].word as string, meaning: rows[0].meaning as string, pinyin: rows[0].pinyin as string, hanViet: rows[0].han_viet as string, note: (rows[0].note as string) ?? "", categoryIds };
}

export async function updateCompoundWord(
  id: number, word: string, meaning: string, pinyin: string, hanViet: string, note: string, categoryIds: number[]
): Promise<void> {
  await sql`
    UPDATE compound_words SET word = ${word}, meaning = ${meaning}, pinyin = ${pinyin}, han_viet = ${hanViet}, note = ${note}
    WHERE id = ${id}
  `;
  await sql`DELETE FROM compound_word_categories WHERE word_id = ${id}`;
  for (const cid of categoryIds) {
    await sql`INSERT INTO compound_word_categories (word_id, category_id) VALUES (${id}, ${cid}) ON CONFLICT DO NOTHING`;
  }
}

export async function deleteCompoundWord(id: number): Promise<void> {
  await sql`DELETE FROM compound_words WHERE id = ${id}`;
}

export async function upsertCardEdits(char: string, edits: UserEdits) {
  await sql`
    INSERT INTO chinese_card_edits (char, pinyin, han_viet, meaning_vi, note, updated_at)
    VALUES (
      ${char},
      ${edits.pinyin ?? null}, ${edits.hanViet ?? null},
      ${edits.meaningVi ?? null}, ${edits.note ?? null},
      NOW()
    )
    ON CONFLICT (char)
    DO UPDATE SET
      pinyin     = EXCLUDED.pinyin,
      han_viet   = EXCLUDED.han_viet,
      meaning_vi = EXCLUDED.meaning_vi,
      note       = EXCLUDED.note,
      updated_at = NOW()
  `;
}
