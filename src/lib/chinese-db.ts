import { sql } from "./db";
import type { UserEdits } from "@/src/components/chinese/study/EditCardModal";
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

export interface CardStateWithDate {
  char: string;
  hidden: boolean;
  updatedAt: Date;
}

export async function getCardStatesWithDate(): Promise<CardStateWithDate[]> {
  const rows = await sql`SELECT char, hidden, updated_at FROM chinese_card_state`;
  return rows.map((r) => ({
    char: r.char as string,
    hidden: r.hidden as boolean,
    updatedAt: r.updated_at as Date,
  }));
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

// ── Char groups (Gom từ) ──────────────────────────────────────────────────────

export async function ensureCharGroupTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS char_groups (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS char_group_members (
      group_id INT  NOT NULL REFERENCES char_groups(id) ON DELETE CASCADE,
      char     TEXT NOT NULL,
      PRIMARY KEY (group_id, char)
    )
  `;
}

export interface CharGroup {
  id: number;
  name: string;
  chars: string[];
}

export async function getCharGroups(): Promise<CharGroup[]> {
  const rows = await sql`
    SELECT g.id, g.name,
           COALESCE(array_agg(m.char ORDER BY m.char) FILTER (WHERE m.char IS NOT NULL), '{}') AS chars
    FROM char_groups g
    LEFT JOIN char_group_members m ON g.id = m.group_id
    GROUP BY g.id, g.name
    ORDER BY g.name
  `;
  return rows.map((r) => ({ id: r.id as number, name: r.name as string, chars: r.chars as string[] }));
}

export async function createCharGroup(name: string): Promise<CharGroup> {
  const rows = await sql`INSERT INTO char_groups (name) VALUES (${name}) RETURNING id, name`;
  return { id: rows[0].id as number, name: rows[0].name as string, chars: [] };
}

export async function deleteCharGroup(id: number): Promise<void> {
  await sql`DELETE FROM char_groups WHERE id = ${id}`;
}

export async function addCharsToGroup(groupId: number, chars: string[]): Promise<void> {
  for (const char of chars) {
    await sql`INSERT INTO char_group_members (group_id, char) VALUES (${groupId}, ${char}) ON CONFLICT DO NOTHING`;
  }
}

export async function removeCharFromGroup(groupId: number, char: string): Promise<void> {
  await sql`DELETE FROM char_group_members WHERE group_id = ${groupId} AND char = ${char}`;
}

// ── Review history ───────────────────────────────────────────────────────────

export async function ensureReviewHistoryTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS chinese_review_history (
      id            SERIAL PRIMARY KEY,
      text          TEXT NOT NULL,
      learned_count INT  NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

export interface ReviewHistoryItem {
  id: number;
  text: string;
  learnedCount: number;
  createdAt: string;
}

export async function saveReviewHistory(text: string, learnedCount: number): Promise<ReviewHistoryItem> {
  const rows = await sql`
    INSERT INTO chinese_review_history (text, learned_count)
    VALUES (${text}, ${learnedCount})
    RETURNING id, text, learned_count, created_at
  `;
  return {
    id: rows[0].id as number,
    text: rows[0].text as string,
    learnedCount: rows[0].learned_count as number,
    createdAt: (rows[0].created_at as Date).toISOString(),
  };
}

export async function getReviewHistory(limit = 20): Promise<ReviewHistoryItem[]> {
  const rows = await sql`
    SELECT id, text, learned_count, created_at
    FROM chinese_review_history
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    id: r.id as number,
    text: r.text as string,
    learnedCount: r.learned_count as number,
    createdAt: (r.created_at as Date).toISOString(),
  }));
}

export async function deleteReviewHistory(id: number): Promise<void> {
  await sql`DELETE FROM chinese_review_history WHERE id = ${id}`;
}

// ── Grammar posts ─────────────────────────────────────────────────────────────

export async function ensureGrammarTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS grammar_posts (
      id         SERIAL PRIMARY KEY,
      title      TEXT NOT NULL,
      content    TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

export interface GrammarPost {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export async function getGrammarPosts(): Promise<GrammarPost[]> {
  const rows = await sql`SELECT id, title, content, created_at, updated_at FROM grammar_posts ORDER BY id DESC`;
  return rows.map((r) => ({
    id: r.id as number,
    title: r.title as string,
    content: r.content as string,
    createdAt: (r.created_at as Date).toISOString(),
    updatedAt: (r.updated_at as Date).toISOString(),
  }));
}

export async function createGrammarPost(title: string, content: string): Promise<GrammarPost> {
  const rows = await sql`
    INSERT INTO grammar_posts (title, content) VALUES (${title}, ${content})
    RETURNING id, title, content, created_at, updated_at
  `;
  return {
    id: rows[0].id as number,
    title: rows[0].title as string,
    content: rows[0].content as string,
    createdAt: (rows[0].created_at as Date).toISOString(),
    updatedAt: (rows[0].updated_at as Date).toISOString(),
  };
}

export async function updateGrammarPost(id: number, title: string, content: string): Promise<void> {
  await sql`
    UPDATE grammar_posts SET title = ${title}, content = ${content}, updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function deleteGrammarPost(id: number): Promise<void> {
  await sql`DELETE FROM grammar_posts WHERE id = ${id}`;
}

// ── Flashcard SRS (SM-2) ──────────────────────────────────────────────────────

export type FlashcardMode = "flip" | "write";

export async function ensureFlashcardTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS chinese_flashcard_flip (
      char          TEXT NOT NULL PRIMARY KEY,
      due_date      DATE NOT NULL DEFAULT CURRENT_DATE,
      interval      INT  NOT NULL DEFAULT 1,
      ease_factor   REAL NOT NULL DEFAULT 2.5,
      repetitions   INT  NOT NULL DEFAULT 0,
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS chinese_flashcard_write (
      char          TEXT NOT NULL PRIMARY KEY,
      due_date      DATE NOT NULL DEFAULT CURRENT_DATE,
      interval      INT  NOT NULL DEFAULT 1,
      ease_factor   REAL NOT NULL DEFAULT 2.5,
      repetitions   INT  NOT NULL DEFAULT 0,
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

export interface FlashcardRow {
  char: string;
  dueDate: string;
  interval: number;
  easeFactor: number;
  repetitions: number;
}

function flashcardTable(mode: FlashcardMode) {
  return mode === "flip" ? "chinese_flashcard_flip" : "chinese_flashcard_write";
}


export async function seedFlashcardsForLearnedChars(mode: FlashcardMode): Promise<void> {
  if (mode === "flip") {
    await sql`INSERT INTO chinese_flashcard_flip (char) SELECT char FROM chinese_card_state WHERE hidden = TRUE ON CONFLICT (char) DO NOTHING`;
  } else {
    await sql`INSERT INTO chinese_flashcard_write (char) SELECT char FROM chinese_card_state WHERE hidden = TRUE ON CONFLICT (char) DO NOTHING`;
  }
}

export async function getFlashcardsDueToday(mode: FlashcardMode): Promise<string[]> {
  await seedFlashcardsForLearnedChars(mode);
  let rows;
  if (mode === "flip") {
    rows = await sql`
      SELECT f.char FROM chinese_flashcard_flip f
      JOIN chinese_card_state s ON s.char = f.char
      WHERE s.hidden = TRUE AND f.due_date <= CURRENT_DATE
      ORDER BY f.due_date ASC
    `;
  } else {
    rows = await sql`
      SELECT f.char FROM chinese_flashcard_write f
      JOIN chinese_card_state s ON s.char = f.char
      WHERE s.hidden = TRUE AND f.due_date <= CURRENT_DATE
      ORDER BY f.due_date ASC
    `;
  }
  return rows.map((r) => r.char as string);
}

function calcNextInterval(grade: 0 | 1 | 2 | 3, interval: number, easeFactor: number, repetitions: number) {
  // grade 0 = Again: restart, penalize EF
  if (grade === 0) return { interval: 1, easeFactor: Math.max(1.3, easeFactor - 0.2), repetitions: 0 };
  // grade 1 = Hard: keep progressing but reduce EF and grow interval slowly
  if (grade === 1) {
    const next = repetitions === 0 ? 1 : repetitions === 1 ? 3 : Math.max(1, Math.round(interval * 1.2));
    return { interval: next, easeFactor: Math.max(1.3, easeFactor - 0.15), repetitions: repetitions + 1 };
  }
  // grade 2 = Good: standard SM-2
  if (grade === 2) {
    const next = repetitions === 0 ? 1 : repetitions === 1 ? 6 : Math.round(interval * easeFactor);
    return { interval: next, easeFactor, repetitions: repetitions + 1 };
  }
  // grade 3 = Easy: bonus interval, increase EF
  const next = repetitions === 0 ? 4 : repetitions === 1 ? 10 : Math.round(interval * easeFactor * 1.3);
  return { interval: next, easeFactor: Math.min(2.5, easeFactor + 0.15), repetitions: repetitions + 1 };
}

export async function upsertFlashcard(char: string, grade: 0 | 1 | 2 | 3, mode: FlashcardMode): Promise<void> {
  let rows;
  if (mode === "flip") {
    rows = await sql`SELECT interval, ease_factor, repetitions FROM chinese_flashcard_flip WHERE char = ${char}`;
  } else {
    rows = await sql`SELECT interval, ease_factor, repetitions FROM chinese_flashcard_write WHERE char = ${char}`;
  }

  const { interval, easeFactor, repetitions } = calcNextInterval(
    grade,
    (rows[0]?.interval as number) ?? 1,
    (rows[0]?.ease_factor as number) ?? 2.5,
    (rows[0]?.repetitions as number) ?? 0,
  );

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + interval);
  const dueDateStr = dueDate.toISOString().slice(0, 10);

  if (mode === "flip") {
    await sql`
      INSERT INTO chinese_flashcard_flip (char, due_date, interval, ease_factor, repetitions, updated_at)
      VALUES (${char}, ${dueDateStr}, ${interval}, ${easeFactor}, ${repetitions}, NOW())
      ON CONFLICT (char) DO UPDATE SET
        due_date = ${dueDateStr},
        interval = ${interval},
        ease_factor = ${easeFactor},
        repetitions = ${repetitions},
        updated_at = NOW()
    `;
  } else {
    await sql`
      INSERT INTO chinese_flashcard_write (char, due_date, interval, ease_factor, repetitions, updated_at)
      VALUES (${char}, ${dueDateStr}, ${interval}, ${easeFactor}, ${repetitions}, NOW())
      ON CONFLICT (char) DO UPDATE SET
        due_date = ${dueDateStr},
        interval = ${interval},
        ease_factor = ${easeFactor},
        repetitions = ${repetitions},
        updated_at = NOW()
    `;
  }
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
