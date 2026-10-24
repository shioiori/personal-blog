import { sql } from "./db";
import type { EnglishWord, EnglishSense, EnglishGroup, FlashcardCard, ImportWordInput } from "@/src/declaration/english";

// ── Schema ────────────────────────────────────────────────────────────────────

export async function ensureEnglishTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS english_words (
      id         SERIAL PRIMARY KEY,
      word       TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    ALTER TABLE english_words ADD COLUMN IF NOT EXISTS crawl_data JSONB
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS english_senses (
      id                SERIAL PRIMARY KEY,
      word_id           INT NOT NULL REFERENCES english_words(id) ON DELETE CASCADE,
      phonetic          TEXT,
      part_of_speech    TEXT,
      cambridge_meaning TEXT,
      meaning_vi        TEXT,
      example           TEXT,
      synonyms          TEXT,
      antonyms          TEXT,
      sort_order        INT NOT NULL DEFAULT 0
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS english_word_groups (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS english_word_group_members (
      group_id INT NOT NULL REFERENCES english_word_groups(id) ON DELETE CASCADE,
      word_id  INT NOT NULL REFERENCES english_words(id) ON DELETE CASCADE,
      PRIMARY KEY (group_id, word_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS english_flashcard (
      word_id     INT PRIMARY KEY REFERENCES english_words(id) ON DELETE CASCADE,
      active      BOOLEAN NOT NULL DEFAULT TRUE,
      due_date    DATE NOT NULL DEFAULT CURRENT_DATE,
      interval    INT NOT NULL DEFAULT 1,
      ease_factor REAL NOT NULL DEFAULT 2.5,
      repetitions INT NOT NULL DEFAULT 0,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

// ── SM-2 SRS algorithm (self-contained, mirrors chinese-db.ts) ──────────────────

export function calcNextInterval(grade: 0 | 1 | 2 | 3, interval: number, easeFactor: number, repetitions: number) {
  if (grade === 0) return { interval: 1, easeFactor: Math.max(1.3, easeFactor - 0.2), repetitions: 0 };
  if (grade === 1) {
    const next = repetitions === 0 ? 1 : repetitions === 1 ? 3 : Math.max(1, Math.round(interval * 1.2));
    return { interval: next, easeFactor: Math.max(1.3, easeFactor - 0.15), repetitions: repetitions + 1 };
  }
  if (grade === 2) {
    const next = repetitions === 0 ? 1 : repetitions === 1 ? 6 : Math.round(interval * easeFactor);
    return { interval: next, easeFactor, repetitions: repetitions + 1 };
  }
  const next = repetitions === 0 ? 4 : repetitions === 1 ? 10 : Math.round(interval * easeFactor * 1.3);
  return { interval: next, easeFactor: Math.min(2.5, easeFactor + 0.15), repetitions: repetitions + 1 };
}

// ── Words / senses ───────────────────────────────────────────────────────────

export interface SenseInput {
  phonetic?: string | null;
  partOfSpeech?: string | null;
  cambridgeMeaning?: string | null;
  meaningVi?: string | null;
  example?: string | null;
  synonyms?: string | null;
  antonyms?: string | null;
}

function mapSenseRow(r: Record<string, unknown>): EnglishSense {
  return {
    id: r.id as number,
    phonetic: (r.phonetic as string | null) ?? undefined,
    partOfSpeech: (r.part_of_speech as string | null) ?? undefined,
    cambridgeMeaning: (r.cambridge_meaning as string | null) ?? undefined,
    meaningVi: (r.meaning_vi as string | null) ?? undefined,
    example: (r.example as string | null) ?? undefined,
    synonyms: (r.synonyms as string | null) ?? undefined,
    antonyms: (r.antonyms as string | null) ?? undefined,
    sortOrder: (r.sort_order as number) ?? 0,
  };
}

async function insertSenses(wordId: number, senses: SenseInput[]): Promise<void> {
  for (let i = 0; i < senses.length; i++) {
    const s = senses[i];
    await sql`
      INSERT INTO english_senses (word_id, phonetic, part_of_speech, cambridge_meaning, meaning_vi, example, synonyms, antonyms, sort_order)
      VALUES (${wordId}, ${s.phonetic ?? null}, ${s.partOfSpeech ?? null}, ${s.cambridgeMeaning ?? null}, ${s.meaningVi ?? null}, ${s.example ?? null}, ${s.synonyms ?? null}, ${s.antonyms ?? null}, ${i})
    `;
  }
}

export async function createWord(word: string, senses: SenseInput[], crawlData?: unknown): Promise<EnglishWord> {
  const rows = await sql`INSERT INTO english_words (word) VALUES (${word}) RETURNING id, word, created_at`;
  const id = rows[0].id as number;
  if (senses.length > 0) await insertSenses(id, senses);
  else await insertSenses(id, [{}]);
  await sql`
    INSERT INTO english_flashcard (word_id, active) VALUES (${id}, TRUE)
    ON CONFLICT (word_id) DO NOTHING
  `;
  if (crawlData) await upsertWordCrawlData(id, crawlData);
  const created = await getWord(id);
  if (!created) throw new Error("failed to load created word");
  return created;
}

export async function updateWord(id: number, word: string, senses: SenseInput[]): Promise<void> {
  await sql`UPDATE english_words SET word = ${word} WHERE id = ${id}`;
  await sql`DELETE FROM english_senses WHERE word_id = ${id}`;
  if (senses.length > 0) await insertSenses(id, senses);
  else await insertSenses(id, [{}]);
}

export async function deleteWord(id: number): Promise<void> {
  await sql`DELETE FROM english_words WHERE id = ${id}`;
}

// ── Cambridge crawl-data cache (mirrors chinese's crawl_data pattern) ───────────

export async function getWordCrawlData(id: number): Promise<unknown | null> {
  const rows = await sql`SELECT crawl_data FROM english_words WHERE id = ${id}`;
  return (rows[0]?.crawl_data as unknown | null) ?? null;
}

export async function upsertWordCrawlData(id: number, crawlData: unknown): Promise<void> {
  await sql`
    UPDATE english_words SET crawl_data = ${JSON.stringify(crawlData)}::jsonb WHERE id = ${id}
  `;
}

export async function getWord(id: number): Promise<EnglishWord | null> {
  const wordRows = await sql`SELECT id, word, created_at, crawl_data FROM english_words WHERE id = ${id}`;
  if (!wordRows[0]) return null;
  const senseRows = await sql`SELECT * FROM english_senses WHERE word_id = ${id} ORDER BY sort_order ASC, id ASC`;
  const groupRows = await sql`SELECT group_id FROM english_word_group_members WHERE word_id = ${id}`;
  const fcRows = await sql`SELECT active FROM english_flashcard WHERE word_id = ${id}`;
  return {
    id: wordRows[0].id as number,
    word: wordRows[0].word as string,
    createdAt: (wordRows[0].created_at as Date).toISOString(),
    senses: senseRows.map(mapSenseRow),
    groupIds: groupRows.map((r) => r.group_id as number),
    flashcardActive: (fcRows[0]?.active as boolean) ?? true,
    crawlData: (wordRows[0].crawl_data as unknown | null) ?? undefined,
  };
}

export async function listWords(opts: { groupId?: number; search?: string } = {}): Promise<EnglishWord[]> {
  let wordRows;
  if (opts.groupId) {
    wordRows = await sql`
      SELECT w.id, w.word, w.created_at, w.crawl_data FROM english_words w
      JOIN english_word_group_members m ON m.word_id = w.id
      WHERE m.group_id = ${opts.groupId}
      ORDER BY w.word ASC
    `;
  } else if (opts.search) {
    const pattern = `%${opts.search}%`;
    wordRows = await sql`
      SELECT id, word, created_at, crawl_data FROM english_words
      WHERE word ILIKE ${pattern}
      ORDER BY word ASC
    `;
  } else {
    wordRows = await sql`SELECT id, word, created_at, crawl_data FROM english_words ORDER BY word ASC`;
  }

  if (wordRows.length === 0) return [];
  const ids = wordRows.map((r) => r.id as number);

  const senseRows = await sql`SELECT * FROM english_senses WHERE word_id = ANY(${ids}) ORDER BY sort_order ASC, id ASC`;
  const groupRows = await sql`SELECT word_id, group_id FROM english_word_group_members WHERE word_id = ANY(${ids})`;
  const fcRows = await sql`SELECT word_id, active FROM english_flashcard WHERE word_id = ANY(${ids})`;

  const sensesByWord = new Map<number, EnglishSense[]>();
  for (const r of senseRows) {
    const wid = r.word_id as number;
    if (!sensesByWord.has(wid)) sensesByWord.set(wid, []);
    sensesByWord.get(wid)!.push(mapSenseRow(r));
  }
  const groupsByWord = new Map<number, number[]>();
  for (const r of groupRows) {
    const wid = r.word_id as number;
    if (!groupsByWord.has(wid)) groupsByWord.set(wid, []);
    groupsByWord.get(wid)!.push(r.group_id as number);
  }
  const activeByWord = new Map<number, boolean>();
  for (const r of fcRows) activeByWord.set(r.word_id as number, r.active as boolean);

  return wordRows.map((r) => {
    const id = r.id as number;
    return {
      id,
      word: r.word as string,
      createdAt: (r.created_at as Date).toISOString(),
      senses: sensesByWord.get(id) ?? [],
      groupIds: groupsByWord.get(id) ?? [],
      flashcardActive: activeByWord.get(id) ?? true,
      crawlData: (r.crawl_data as unknown | null) ?? undefined,
    };
  });
}

// ── Groups ───────────────────────────────────────────────────────────────────

export async function listGroups(): Promise<EnglishGroup[]> {
  const rows = await sql`
    SELECT g.id, g.name,
           COALESCE(array_agg(m.word_id) FILTER (WHERE m.word_id IS NOT NULL), '{}') AS word_ids
    FROM english_word_groups g
    LEFT JOIN english_word_group_members m ON g.id = m.group_id
    GROUP BY g.id, g.name
    ORDER BY g.name
  `;
  return rows.map((r) => ({ id: r.id as number, name: r.name as string, wordIds: (r.word_ids as number[]) ?? [] }));
}

export async function createGroup(name: string): Promise<EnglishGroup> {
  const rows = await sql`INSERT INTO english_word_groups (name) VALUES (${name}) RETURNING id, name`;
  return { id: rows[0].id as number, name: rows[0].name as string, wordIds: [] };
}

export async function renameGroup(id: number, name: string): Promise<void> {
  await sql`UPDATE english_word_groups SET name = ${name} WHERE id = ${id}`;
}

export async function deleteGroup(id: number): Promise<void> {
  await sql`DELETE FROM english_word_groups WHERE id = ${id}`;
}

export async function addWordsToGroup(groupId: number, wordIds: number[]): Promise<void> {
  for (const wordId of wordIds) {
    await sql`INSERT INTO english_word_group_members (group_id, word_id) VALUES (${groupId}, ${wordId}) ON CONFLICT DO NOTHING`;
  }
}

export async function removeWordFromGroup(groupId: number, wordId: number): Promise<void> {
  await sql`DELETE FROM english_word_group_members WHERE group_id = ${groupId} AND word_id = ${wordId}`;
}

// ── Flashcard / SRS ──────────────────────────────────────────────────────────

export async function setFlashcardActive(wordId: number, active: boolean): Promise<void> {
  await sql`
    INSERT INTO english_flashcard (word_id, active) VALUES (${wordId}, ${active})
    ON CONFLICT (word_id) DO UPDATE SET active = ${active}, updated_at = NOW()
  `;
}

export async function getFlashcardsDueToday(opts: { limit?: number; order?: "due" | "random" } = {}): Promise<FlashcardCard[]> {
  const rows = await sql`
    SELECT w.id, w.word
    FROM english_flashcard f
    JOIN english_words w ON w.id = f.word_id
    WHERE f.active = TRUE AND f.due_date <= CURRENT_DATE
    ORDER BY f.due_date ASC
  `;
  let cards = rows.map((r) => ({ wordId: r.id as number, word: r.word as string }));
  if (opts.order === "random") cards = cards.sort(() => Math.random() - 0.5);
  if (opts.limit && opts.limit > 0) cards = cards.slice(0, opts.limit);
  if (cards.length === 0) return [];

  const ids = cards.map((c) => c.wordId);
  const senseRows = await sql`SELECT * FROM english_senses WHERE word_id = ANY(${ids}) ORDER BY sort_order ASC, id ASC`;
  const sensesByWord = new Map<number, EnglishSense[]>();
  for (const r of senseRows) {
    const wid = r.word_id as number;
    if (!sensesByWord.has(wid)) sensesByWord.set(wid, []);
    sensesByWord.get(wid)!.push(mapSenseRow(r));
  }
  return cards.map((c) => ({ ...c, senses: sensesByWord.get(c.wordId) ?? [] }));
}

export async function upsertFlashcardGrade(wordId: number, grade: 0 | 1 | 2 | 3): Promise<void> {
  const rows = await sql`SELECT interval, ease_factor, repetitions FROM english_flashcard WHERE word_id = ${wordId}`;
  const { interval, easeFactor, repetitions } = calcNextInterval(
    grade,
    (rows[0]?.interval as number) ?? 1,
    (rows[0]?.ease_factor as number) ?? 2.5,
    (rows[0]?.repetitions as number) ?? 0,
  );
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + interval);
  const dueDateStr = dueDate.toISOString().slice(0, 10);

  await sql`
    INSERT INTO english_flashcard (word_id, active, due_date, interval, ease_factor, repetitions, updated_at)
    VALUES (${wordId}, TRUE, ${dueDateStr}, ${interval}, ${easeFactor}, ${repetitions}, NOW())
    ON CONFLICT (word_id) DO UPDATE SET
      due_date = ${dueDateStr},
      interval = ${interval},
      ease_factor = ${easeFactor},
      repetitions = ${repetitions},
      updated_at = NOW()
  `;
}

// ── Bulk import ──────────────────────────────────────────────────────────────

export async function bulkImportWords(
  items: ImportWordInput[],
  groupId?: number,
  onDuplicate: "skip" | "overwrite" = "skip"
): Promise<{ created: number; overwritten: number; skipped: string[] }> {
  const existingRows = await sql`SELECT id, LOWER(word) AS w FROM english_words`;
  const existingIdByWord = new Map<string, number>(existingRows.map((r) => [r.w as string, r.id as number]));

  let created = 0;
  let overwritten = 0;
  const skipped: string[] = [];

  for (const item of items) {
    const key = item.word.trim().toLowerCase();
    if (!key) continue;
    const existingId = existingIdByWord.get(key);

    if (existingId !== undefined) {
      if (onDuplicate === "overwrite") {
        const senses: SenseInput[] = item.senses.length > 0 ? item.senses : [{}];
        await updateWord(existingId, item.word.trim(), senses);
        overwritten++;
      } else {
        skipped.push(item.word);
      }
      if (groupId) {
        await sql`INSERT INTO english_word_group_members (group_id, word_id) VALUES (${groupId}, ${existingId}) ON CONFLICT DO NOTHING`;
      }
      continue;
    }

    const senses: SenseInput[] = item.senses.length > 0 ? item.senses : [{}];
    const rows = await sql`INSERT INTO english_words (word) VALUES (${item.word.trim()}) RETURNING id`;
    const wordId = rows[0].id as number;
    existingIdByWord.set(key, wordId);
    await insertSenses(wordId, senses);
    await sql`INSERT INTO english_flashcard (word_id, active) VALUES (${wordId}, TRUE) ON CONFLICT (word_id) DO NOTHING`;
    if (groupId) {
      await sql`INSERT INTO english_word_group_members (group_id, word_id) VALUES (${groupId}, ${wordId}) ON CONFLICT DO NOTHING`;
    }
    created++;
  }

  return { created, overwritten, skipped };
}
