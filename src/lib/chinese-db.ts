import { sql } from "./db";
import type { UserEdits } from "@/src/components/chinese/study/EditCardModal";
import type { CompoundCategory, CompoundWord } from "@/src/declaration/chinese";

export async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS chinese_card_state (
      user_id    INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      char       TEXT NOT NULL,
      hidden     BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, char)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS chinese_card_edits (
      user_id     INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      char        TEXT NOT NULL,
      pinyin      TEXT,
      han_viet    TEXT,
      meaning_vi  TEXT,
      note        TEXT,
      crawl_data  JSONB,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, char)
    )
  `;
  await sql`
    ALTER TABLE chinese_card_edits ADD COLUMN IF NOT EXISTS crawl_data JSONB
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

export async function getCardStates(userId: number): Promise<Record<string, boolean>> {
  const rows = await sql`SELECT char, hidden FROM chinese_card_state WHERE user_id = ${userId}`;
  return Object.fromEntries(rows.map((r) => [r.char, r.hidden]));
}

export interface CardStateWithDate {
  char: string;
  hidden: boolean;
  updatedAt: Date;
}

export async function getCardStatesWithDate(userId: number): Promise<CardStateWithDate[]> {
  const rows = await sql`SELECT char, hidden, updated_at FROM chinese_card_state WHERE user_id = ${userId}`;
  return rows.map((r) => ({
    char: r.char as string,
    hidden: r.hidden as boolean,
    updatedAt: r.updated_at as Date,
  }));
}

export async function upsertCardState(userId: number, char: string, hidden: boolean) {
  await sql`
    INSERT INTO chinese_card_state (user_id, char, hidden, updated_at)
    VALUES (${userId}, ${char}, ${hidden}, NOW())
    ON CONFLICT (user_id, char)
    DO UPDATE SET hidden = EXCLUDED.hidden, updated_at = NOW()
  `;
}

// ── Card edits (user annotations) ────────────────────────────────────────────

export async function getCardEdits(userId: number): Promise<Record<string, UserEdits>> {
  const rows = await sql`
    SELECT char, pinyin, han_viet, meaning_vi, note FROM chinese_card_edits WHERE user_id = ${userId}
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

export async function getCardCrawlData(userId: number, char: string): Promise<unknown | null> {
  const rows = await sql`
    SELECT crawl_data FROM chinese_card_edits WHERE user_id = ${userId} AND char = ${char}
  `;
  return (rows[0]?.crawl_data as unknown | null) ?? null;
}

export async function upsertCardCrawlData(userId: number, char: string, crawlData: unknown): Promise<void> {
  await sql`
    INSERT INTO chinese_card_edits (user_id, char, crawl_data, updated_at)
    VALUES (${userId}, ${char}, ${JSON.stringify(crawlData)}::jsonb, NOW())
    ON CONFLICT (user_id, char)
    DO UPDATE SET crawl_data = EXCLUDED.crawl_data, updated_at = NOW()
  `;
}

// ── Compound words ────────────────────────────────────────────────────────────

export async function ensureCompoundTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS compound_categories (
      id         SERIAL PRIMARY KEY,
      user_id    INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT compound_categories_user_name_key UNIQUE (user_id, name)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS compound_words (
      id         SERIAL PRIMARY KEY,
      user_id    INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

export async function getCompoundCategories(userId: number): Promise<CompoundCategory[]> {
  const rows = await sql`SELECT id, name FROM compound_categories WHERE user_id = ${userId} ORDER BY name`;
  return rows.map((r) => ({ id: r.id as number, name: r.name as string }));
}

export async function createCompoundCategory(userId: number, name: string): Promise<CompoundCategory> {
  const rows = await sql`
    INSERT INTO compound_categories (user_id, name) VALUES (${userId}, ${name}) RETURNING id, name
  `;
  return { id: rows[0].id as number, name: rows[0].name as string };
}

export async function updateCompoundCategory(userId: number, id: number, name: string): Promise<void> {
  await sql`UPDATE compound_categories SET name = ${name} WHERE id = ${id} AND user_id = ${userId}`;
}

export async function deleteCompoundCategory(userId: number, id: number): Promise<void> {
  await sql`DELETE FROM compound_categories WHERE id = ${id} AND user_id = ${userId}`;
}

export async function getCompoundWords(userId: number): Promise<CompoundWord[]> {
  const rows = await sql`
    SELECT w.id, w.word, w.meaning, w.pinyin, w.han_viet, w.note,
           COALESCE(array_agg(wc.category_id) FILTER (WHERE wc.category_id IS NOT NULL), '{}') AS category_ids
    FROM compound_words w
    LEFT JOIN compound_word_categories wc ON w.id = wc.word_id
    WHERE w.user_id = ${userId}
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

async function linkCompoundWordCategories(userId: number, wordId: number, categoryIds: number[]): Promise<void> {
  if (categoryIds.length === 0) return;
  await sql`
    INSERT INTO compound_word_categories (word_id, category_id)
    SELECT ${wordId}, id FROM compound_categories WHERE user_id = ${userId} AND id = ANY(${categoryIds})
    ON CONFLICT DO NOTHING
  `;
}

export async function createCompoundWord(
  userId: number, word: string, meaning: string, pinyin: string, hanViet: string, note: string, categoryIds: number[]
): Promise<CompoundWord> {
  const rows = await sql`
    INSERT INTO compound_words (user_id, word, meaning, pinyin, han_viet, note)
    VALUES (${userId}, ${word}, ${meaning}, ${pinyin}, ${hanViet}, ${note})
    RETURNING id, word, meaning, pinyin, han_viet, note
  `;
  const id = rows[0].id as number;
  await linkCompoundWordCategories(userId, id, categoryIds);
  return { id, word: rows[0].word as string, meaning: rows[0].meaning as string, pinyin: rows[0].pinyin as string, hanViet: rows[0].han_viet as string, note: (rows[0].note as string) ?? "", categoryIds };
}

export async function updateCompoundWord(
  userId: number, id: number, word: string, meaning: string, pinyin: string, hanViet: string, note: string, categoryIds: number[]
): Promise<void> {
  const rows = await sql`
    UPDATE compound_words SET word = ${word}, meaning = ${meaning}, pinyin = ${pinyin}, han_viet = ${hanViet}, note = ${note}
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING id
  `;
  if (!rows[0]) return;
  await sql`DELETE FROM compound_word_categories WHERE word_id = ${id}`;
  await linkCompoundWordCategories(userId, id, categoryIds);
}

export async function deleteCompoundWord(userId: number, id: number): Promise<void> {
  await sql`DELETE FROM compound_words WHERE id = ${id} AND user_id = ${userId}`;
}

// ── Char groups (Gom từ) ──────────────────────────────────────────────────────

export async function ensureCharGroupTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS char_groups (
      id         SERIAL PRIMARY KEY,
      user_id    INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT char_groups_user_name_key UNIQUE (user_id, name)
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

export async function getCharGroups(userId: number): Promise<CharGroup[]> {
  const rows = await sql`
    SELECT g.id, g.name,
           COALESCE(array_agg(m.char ORDER BY m.char) FILTER (WHERE m.char IS NOT NULL), '{}') AS chars
    FROM char_groups g
    LEFT JOIN char_group_members m ON g.id = m.group_id
    WHERE g.user_id = ${userId}
    GROUP BY g.id, g.name
    ORDER BY g.name
  `;
  return rows.map((r) => ({ id: r.id as number, name: r.name as string, chars: r.chars as string[] }));
}

export async function createCharGroup(userId: number, name: string): Promise<CharGroup> {
  const rows = await sql`INSERT INTO char_groups (user_id, name) VALUES (${userId}, ${name}) RETURNING id, name`;
  return { id: rows[0].id as number, name: rows[0].name as string, chars: [] };
}

export async function renameCharGroup(userId: number, id: number, name: string): Promise<void> {
  await sql`UPDATE char_groups SET name = ${name} WHERE id = ${id} AND user_id = ${userId}`;
}

export async function deleteCharGroup(userId: number, id: number): Promise<void> {
  await sql`DELETE FROM char_groups WHERE id = ${id} AND user_id = ${userId}`;
}

export async function addCharsToGroup(userId: number, groupId: number, chars: string[]): Promise<boolean> {
  const owned = await sql`SELECT 1 FROM char_groups WHERE id = ${groupId} AND user_id = ${userId}`;
  if (!owned[0]) return false;
  await sql`
    INSERT INTO char_group_members (group_id, char)
    SELECT ${groupId}, unnest(${chars}::text[])
    ON CONFLICT DO NOTHING
  `;
  return true;
}

export async function removeCharFromGroup(userId: number, groupId: number, char: string): Promise<void> {
  await sql`
    DELETE FROM char_group_members
    WHERE group_id = ${groupId} AND char = ${char}
      AND group_id IN (SELECT id FROM char_groups WHERE user_id = ${userId})
  `;
}

// ── Review history ───────────────────────────────────────────────────────────

export async function ensureReviewHistoryTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS chinese_review_history (
      id            SERIAL PRIMARY KEY,
      user_id       INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

export async function saveReviewHistory(userId: number, text: string, learnedCount: number): Promise<ReviewHistoryItem> {
  const rows = await sql`
    INSERT INTO chinese_review_history (user_id, text, learned_count)
    VALUES (${userId}, ${text}, ${learnedCount})
    RETURNING id, text, learned_count, created_at
  `;
  return {
    id: rows[0].id as number,
    text: rows[0].text as string,
    learnedCount: rows[0].learned_count as number,
    createdAt: (rows[0].created_at as Date).toISOString(),
  };
}

export async function getReviewHistory(userId: number, limit = 20): Promise<ReviewHistoryItem[]> {
  const rows = await sql`
    SELECT id, text, learned_count, created_at
    FROM chinese_review_history
    WHERE user_id = ${userId}
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

export async function deleteReviewHistory(userId: number, id: number): Promise<void> {
  await sql`DELETE FROM chinese_review_history WHERE id = ${id} AND user_id = ${userId}`;
}

export async function ensureUserTextTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS chinese_user_texts (
      id         SERIAL PRIMARY KEY,
      user_id    INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title      TEXT,
      text       TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    ALTER TABLE chinese_user_texts ADD COLUMN IF NOT EXISTS title TEXT
  `;
}

export interface ChineseUserTextItem {
  id: number;
  title?: string;
  text: string;
  createdAt: string;
}

export async function saveChineseUserText(userId: number, text: string, title?: string): Promise<ChineseUserTextItem> {
  const rows = await sql`
    INSERT INTO chinese_user_texts (user_id, title, text)
    VALUES (${userId}, ${title ?? null}, ${text})
    RETURNING id, title, text, created_at
  `;
  return {
    id: rows[0].id as number,
    title: (rows[0].title as string | null) ?? undefined,
    text: rows[0].text as string,
    createdAt: (rows[0].created_at as Date).toISOString(),
  };
}

export async function getChineseUserTexts(userId: number, limit = 50): Promise<ChineseUserTextItem[]> {
  const rows = await sql`
    SELECT id, title, text, created_at
    FROM chinese_user_texts
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    id: r.id as number,
    title: (r.title as string | null) ?? undefined,
    text: r.text as string,
    createdAt: (r.created_at as Date).toISOString(),
  }));
}

export async function updateChineseUserText(
  userId: number,
  id: number,
  text: string,
  title?: string
): Promise<ChineseUserTextItem | null> {
  const rows = await sql`
    UPDATE chinese_user_texts
    SET title = ${title ?? null}, text = ${text}
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING id, title, text, created_at
  `;
  if (!rows[0]) return null;
  return {
    id: rows[0].id as number,
    title: (rows[0].title as string | null) ?? undefined,
    text: rows[0].text as string,
    createdAt: (rows[0].created_at as Date).toISOString(),
  };
}

export async function deleteChineseUserText(userId: number, id: number): Promise<void> {
  await sql`DELETE FROM chinese_user_texts WHERE id = ${id} AND user_id = ${userId}`;
}

// ── Grammar posts ─────────────────────────────────────────────────────────────

export async function ensureGrammarTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS grammar_posts (
      id         SERIAL PRIMARY KEY,
      user_id    INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

export async function getGrammarPosts(userId: number): Promise<GrammarPost[]> {
  const rows = await sql`SELECT id, title, content, created_at, updated_at FROM grammar_posts WHERE user_id = ${userId} ORDER BY id DESC`;
  return rows.map((r) => ({
    id: r.id as number,
    title: r.title as string,
    content: r.content as string,
    createdAt: (r.created_at as Date).toISOString(),
    updatedAt: (r.updated_at as Date).toISOString(),
  }));
}

export async function createGrammarPost(userId: number, title: string, content: string): Promise<GrammarPost> {
  const rows = await sql`
    INSERT INTO grammar_posts (user_id, title, content) VALUES (${userId}, ${title}, ${content})
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

export async function updateGrammarPost(userId: number, id: number, title: string, content: string): Promise<void> {
  await sql`
    UPDATE grammar_posts SET title = ${title}, content = ${content}, updated_at = NOW()
    WHERE id = ${id} AND user_id = ${userId}
  `;
}

export async function deleteGrammarPost(userId: number, id: number): Promise<void> {
  await sql`DELETE FROM grammar_posts WHERE id = ${id} AND user_id = ${userId}`;
}

// ── Flashcard SRS (SM-2) ──────────────────────────────────────────────────────

export type FlashcardMode = "flip" | "write";

export async function ensureFlashcardTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS chinese_flashcard_flip (
      user_id       INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      char          TEXT NOT NULL,
      due_date      DATE NOT NULL DEFAULT CURRENT_DATE,
      interval      INT  NOT NULL DEFAULT 1,
      ease_factor   REAL NOT NULL DEFAULT 2.5,
      repetitions   INT  NOT NULL DEFAULT 0,
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, char)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS chinese_flashcard_write (
      user_id       INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      char          TEXT NOT NULL,
      due_date      DATE NOT NULL DEFAULT CURRENT_DATE,
      interval      INT  NOT NULL DEFAULT 1,
      ease_factor   REAL NOT NULL DEFAULT 2.5,
      repetitions   INT  NOT NULL DEFAULT 0,
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, char)
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


export async function seedFlashcardsForLearnedChars(userId: number, mode: FlashcardMode): Promise<void> {
  if (mode === "flip") {
    await sql`INSERT INTO chinese_flashcard_flip (user_id, char) SELECT user_id, char FROM chinese_card_state WHERE user_id = ${userId} AND hidden = TRUE ON CONFLICT (user_id, char) DO NOTHING`;
  } else {
    await sql`INSERT INTO chinese_flashcard_write (user_id, char) SELECT user_id, char FROM chinese_card_state WHERE user_id = ${userId} AND hidden = TRUE ON CONFLICT (user_id, char) DO NOTHING`;
  }
}

export async function getFlashcardsDueToday(userId: number, mode: FlashcardMode): Promise<string[]> {
  await seedFlashcardsForLearnedChars(userId, mode);
  let rows;
  if (mode === "flip") {
    rows = await sql`
      SELECT f.char FROM chinese_flashcard_flip f
      JOIN chinese_card_state s ON s.user_id = f.user_id AND s.char = f.char
      WHERE f.user_id = ${userId} AND s.hidden = TRUE AND f.due_date <= CURRENT_DATE
      ORDER BY f.due_date ASC
    `;
  } else {
    rows = await sql`
      SELECT f.char FROM chinese_flashcard_write f
      JOIN chinese_card_state s ON s.user_id = f.user_id AND s.char = f.char
      WHERE f.user_id = ${userId} AND s.hidden = TRUE AND f.due_date <= CURRENT_DATE
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

export async function upsertFlashcard(userId: number, char: string, grade: 0 | 1 | 2 | 3, mode: FlashcardMode): Promise<void> {
  let rows;
  if (mode === "flip") {
    rows = await sql`SELECT interval, ease_factor, repetitions FROM chinese_flashcard_flip WHERE user_id = ${userId} AND char = ${char}`;
  } else {
    rows = await sql`SELECT interval, ease_factor, repetitions FROM chinese_flashcard_write WHERE user_id = ${userId} AND char = ${char}`;
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
      INSERT INTO chinese_flashcard_flip (user_id, char, due_date, interval, ease_factor, repetitions, updated_at)
      VALUES (${userId}, ${char}, ${dueDateStr}, ${interval}, ${easeFactor}, ${repetitions}, NOW())
      ON CONFLICT (user_id, char) DO UPDATE SET
        due_date = ${dueDateStr},
        interval = ${interval},
        ease_factor = ${easeFactor},
        repetitions = ${repetitions},
        updated_at = NOW()
    `;
  } else {
    await sql`
      INSERT INTO chinese_flashcard_write (user_id, char, due_date, interval, ease_factor, repetitions, updated_at)
      VALUES (${userId}, ${char}, ${dueDateStr}, ${interval}, ${easeFactor}, ${repetitions}, NOW())
      ON CONFLICT (user_id, char) DO UPDATE SET
        due_date = ${dueDateStr},
        interval = ${interval},
        ease_factor = ${easeFactor},
        repetitions = ${repetitions},
        updated_at = NOW()
    `;
  }
}

export async function upsertCardEdits(userId: number, char: string, edits: UserEdits) {
  await sql`
    INSERT INTO chinese_card_edits (user_id, char, pinyin, han_viet, meaning_vi, note, updated_at)
    VALUES (
      ${userId}, ${char},
      ${edits.pinyin ?? null}, ${edits.hanViet ?? null},
      ${edits.meaningVi ?? null}, ${edits.note ?? null},
      NOW()
    )
    ON CONFLICT (user_id, char)
    DO UPDATE SET
      pinyin     = EXCLUDED.pinyin,
      han_viet   = EXCLUDED.han_viet,
      meaning_vi = EXCLUDED.meaning_vi,
      note       = EXCLUDED.note,
      updated_at = NOW()
  `;
}
