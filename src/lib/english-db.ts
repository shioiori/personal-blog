import { sql, once } from "./db";
import { deleteImages } from "./english-images";
import type { EnglishWord, EnglishSense, EnglishGroup, FlashcardCard, ImportWordInput } from "@/src/declaration/english";

// ── Schema ────────────────────────────────────────────────────────────────────

export const ensureEnglishTables = once(async function ensureEnglishTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS english_words (
      id         SERIAL PRIMARY KEY,
      user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      word       TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    ALTER TABLE english_words ADD COLUMN IF NOT EXISTS crawl_data JSONB
  `;
  await sql`
    ALTER TABLE english_words ADD COLUMN IF NOT EXISTS related_words TEXT
  `;
  await sql`
    ALTER TABLE english_words ADD COLUMN IF NOT EXISTS alt_spelling TEXT
  `;
  await sql`
    ALTER TABLE english_words ADD COLUMN IF NOT EXISTS source_url TEXT
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
    ALTER TABLE english_senses ADD COLUMN IF NOT EXISTS note TEXT
  `;
  await sql`
    ALTER TABLE english_senses ADD COLUMN IF NOT EXISTS images TEXT[] NOT NULL DEFAULT '{}'
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS english_word_groups (
      id         SERIAL PRIMARY KEY,
      user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT english_word_groups_user_name_key UNIQUE (user_id, name)
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
  await sql`
    CREATE TABLE IF NOT EXISTS english_settings (
      user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key        TEXT NOT NULL,
      value      JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, key)
    )
  `;
});

// ── Settings ─────────────────────────────────────────────────────────────────

export async function getEnglishSetting(userId: number, key: string): Promise<unknown> {
  const rows = await sql`SELECT value FROM english_settings WHERE user_id = ${userId} AND key = ${key}`;
  return rows[0]?.value ?? null;
}

export async function upsertEnglishSetting(userId: number, key: string, value: unknown) {
  await sql`
    INSERT INTO english_settings (user_id, key, value, updated_at)
    VALUES (${userId}, ${key}, ${JSON.stringify(value)}::jsonb, NOW())
    ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
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
  note?: string | null;
  images?: string[] | null;
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
    note: (r.note as string | null) ?? undefined,
    images: (r.images as string[] | null) ?? [],
    sortOrder: (r.sort_order as number) ?? 0,
  };
}

async function insertSenses(wordId: number, senses: SenseInput[]): Promise<void> {
  for (let i = 0; i < senses.length; i++) {
    const s = senses[i];
    await sql`
      INSERT INTO english_senses (word_id, phonetic, part_of_speech, cambridge_meaning, meaning_vi, example, synonyms, antonyms, note, images, sort_order)
      VALUES (${wordId}, ${s.phonetic ?? null}, ${s.partOfSpeech ?? null}, ${s.cambridgeMeaning ?? null}, ${s.meaningVi ?? null}, ${s.example ?? null}, ${s.synonyms ?? null}, ${s.antonyms ?? null}, ${s.note ?? null}, ${s.images ?? []}, ${i})
    `;
  }
}

export async function createWord(userId: number, word: string, senses: SenseInput[], crawlData?: unknown, relatedWords?: string | null, altSpelling?: string | null, sourceUrl?: string | null): Promise<EnglishWord> {
  const rows = await sql`INSERT INTO english_words (user_id, word, related_words, alt_spelling, source_url) VALUES (${userId}, ${word}, ${relatedWords ?? null}, ${altSpelling ?? null}, ${sourceUrl ?? null}) RETURNING id, word, created_at`;
  const id = rows[0].id as number;
  if (senses.length > 0) await insertSenses(id, senses);
  else await insertSenses(id, [{}]);
  await sql`
    INSERT INTO english_flashcard (word_id, active) VALUES (${id}, TRUE)
    ON CONFLICT (word_id) DO NOTHING
  `;
  if (crawlData) await upsertWordCrawlData(userId, id, crawlData);
  if (sourceUrl) {
    const groupId = await getOrCreateGroupByUrl(userId, sourceUrl);
    await addWordsToGroup(userId, groupId, [id]);
  }
  const created = await getWord(userId, id);
  if (!created) throw new Error("failed to load created word");
  return created;
}

// Groups words added from the same web page together, named after that
// page's hostname (e.g. "en.wikipedia.org"), so words captured via the
// extension land in one shared category instead of a group per URL.
async function getOrCreateGroupByUrl(userId: number, sourceUrl: string): Promise<number> {
  let name: string;
  try {
    name = new URL(sourceUrl).hostname || sourceUrl;
  } catch {
    name = sourceUrl;
  }
  const existing = await sql`SELECT id FROM english_word_groups WHERE user_id = ${userId} AND name = ${name}`;
  if (existing[0]) return existing[0].id as number;
  const created = await createGroup(userId, name);
  return created.id;
}

export async function updateWord(userId: number, id: number, word: string, senses: SenseInput[], relatedWords?: string | null, altSpelling?: string | null): Promise<boolean> {
  const rows = await sql`UPDATE english_words SET word = ${word}, related_words = ${relatedWords ?? null}, alt_spelling = ${altSpelling ?? null} WHERE id = ${id} AND user_id = ${userId} RETURNING id`;
  if (!rows[0]) return false;
  const oldImages = await getSenseImages(id);
  await sql`DELETE FROM english_senses WHERE word_id = ${id}`;
  if (senses.length > 0) await insertSenses(id, senses);
  else await insertSenses(id, [{}]);
  const kept = new Set(senses.flatMap((s) => s.images ?? []));
  await deleteImages(userId, oldImages.filter((k) => !kept.has(k)));
  return true;
}

export async function deleteWord(userId: number, id: number): Promise<void> {
  const rows = await sql`SELECT id FROM english_words WHERE id = ${id} AND user_id = ${userId}`;
  if (!rows[0]) return;
  const images = await getSenseImages(id);
  await sql`DELETE FROM english_words WHERE id = ${id} AND user_id = ${userId}`;
  await deleteImages(userId, images);
}

async function getSenseImages(wordId: number): Promise<string[]> {
  const rows = await sql`SELECT images FROM english_senses WHERE word_id = ${wordId}`;
  return rows.flatMap((r) => (r.images as string[] | null) ?? []);
}

// ── Cambridge crawl-data cache (mirrors chinese's crawl_data pattern) ───────────

export async function getWordCrawlData(userId: number, id: number): Promise<unknown | null> {
  const rows = await sql`SELECT crawl_data FROM english_words WHERE id = ${id} AND user_id = ${userId}`;
  return (rows[0]?.crawl_data as unknown | null) ?? null;
}

export async function upsertWordCrawlData(userId: number, id: number, crawlData: unknown): Promise<void> {
  await sql`
    UPDATE english_words SET crawl_data = ${JSON.stringify(crawlData)}::jsonb WHERE id = ${id} AND user_id = ${userId}
  `;
}

// Case-insensitive lookup by exact word or alt spelling, used to warn the
// user before spending AI tokens re-defining a word they already have.
export async function findWordByText(userId: number, text: string): Promise<{ id: number; word: string } | null> {
  const rows = await sql`
    SELECT id, word FROM english_words
    WHERE user_id = ${userId} AND (LOWER(word) = LOWER(${text}) OR LOWER(alt_spelling) = LOWER(${text}))
    LIMIT 1
  `;
  return rows[0] ? { id: rows[0].id as number, word: rows[0].word as string } : null;
}

export async function getWord(userId: number, id: number): Promise<EnglishWord | null> {
  const wordRows = await sql`SELECT id, word, created_at, crawl_data, related_words, alt_spelling, source_url FROM english_words WHERE id = ${id} AND user_id = ${userId}`;
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
    relatedWords: (wordRows[0].related_words as string | null) ?? undefined,
    altSpelling: (wordRows[0].alt_spelling as string | null) ?? undefined,
    sourceUrl: (wordRows[0].source_url as string | null) ?? undefined,
  };
}

export async function listWords(userId: number, opts: { groupId?: number; search?: string } = {}): Promise<EnglishWord[]> {
  let wordRows;
  if (opts.groupId) {
    wordRows = await sql`
      SELECT w.id, w.word, w.created_at, w.crawl_data, w.related_words, w.alt_spelling, w.source_url FROM english_words w
      JOIN english_word_group_members m ON m.word_id = w.id
      WHERE m.group_id = ${opts.groupId} AND w.user_id = ${userId}
      ORDER BY w.word ASC
    `;
  } else if (opts.search) {
    const pattern = `%${opts.search}%`;
    wordRows = await sql`
      SELECT id, word, created_at, crawl_data, related_words, alt_spelling, source_url FROM english_words
      WHERE user_id = ${userId} AND (word ILIKE ${pattern} OR alt_spelling ILIKE ${pattern})
      ORDER BY word ASC
    `;
  } else {
    wordRows = await sql`SELECT id, word, created_at, crawl_data, related_words, alt_spelling, source_url FROM english_words WHERE user_id = ${userId} ORDER BY word ASC`;
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
      relatedWords: (r.related_words as string | null) ?? undefined,
      altSpelling: (r.alt_spelling as string | null) ?? undefined,
      sourceUrl: (r.source_url as string | null) ?? undefined,
    };
  });
}

// ── Groups ───────────────────────────────────────────────────────────────────

// Ensures every word with a source_url belongs to a group named after that
// URL's hostname — even when source_url was set outside createWord (e.g. a
// direct DB edit), so group membership never drifts out of sync with it.
async function syncGroupsFromSourceUrls(userId: number): Promise<void> {
  const rows = await sql`SELECT id, source_url FROM english_words WHERE user_id = ${userId} AND source_url IS NOT NULL`;
  if (rows.length === 0) return;

  const wordIdsByName = new Map<string, number[]>();
  for (const r of rows) {
    const sourceUrl = r.source_url as string;
    let name: string;
    try {
      name = new URL(sourceUrl).hostname || sourceUrl;
    } catch {
      name = sourceUrl;
    }
    if (!wordIdsByName.has(name)) wordIdsByName.set(name, []);
    wordIdsByName.get(name)!.push(r.id as number);
  }

  for (const [name, wordIds] of wordIdsByName) {
    const existing = await sql`SELECT id FROM english_word_groups WHERE user_id = ${userId} AND name = ${name}`;
    const groupId = existing[0] ? (existing[0].id as number) : (await createGroup(userId, name)).id;
    await addWordsToGroup(userId, groupId, wordIds);
  }
}

export async function listGroups(userId: number): Promise<EnglishGroup[]> {
  await syncGroupsFromSourceUrls(userId);
  const rows = await sql`
    SELECT g.id, g.name,
           COALESCE(array_agg(m.word_id) FILTER (WHERE m.word_id IS NOT NULL), '{}') AS word_ids
    FROM english_word_groups g
    LEFT JOIN english_word_group_members m ON g.id = m.group_id
    WHERE g.user_id = ${userId}
    GROUP BY g.id, g.name
    ORDER BY g.name
  `;
  return rows.map((r) => ({ id: r.id as number, name: r.name as string, wordIds: (r.word_ids as number[]) ?? [] }));
}

export async function createGroup(userId: number, name: string): Promise<EnglishGroup> {
  const rows = await sql`INSERT INTO english_word_groups (user_id, name) VALUES (${userId}, ${name}) RETURNING id, name`;
  return { id: rows[0].id as number, name: rows[0].name as string, wordIds: [] };
}

export async function renameGroup(userId: number, id: number, name: string): Promise<void> {
  await sql`UPDATE english_word_groups SET name = ${name} WHERE id = ${id} AND user_id = ${userId}`;
}

export async function deleteGroup(userId: number, id: number): Promise<void> {
  await sql`DELETE FROM english_word_groups WHERE id = ${id} AND user_id = ${userId}`;
}

export async function addWordsToGroup(userId: number, groupId: number, wordIds: number[]): Promise<void> {
  await sql`
    INSERT INTO english_word_group_members (group_id, word_id)
    SELECT g.id, w.id FROM english_word_groups g
    JOIN english_words w ON w.user_id = g.user_id
    WHERE g.id = ${groupId} AND g.user_id = ${userId} AND w.id = ANY(${wordIds})
    ON CONFLICT DO NOTHING
  `;
}

export async function removeWordFromGroup(userId: number, groupId: number, wordId: number): Promise<void> {
  await sql`
    DELETE FROM english_word_group_members
    WHERE group_id = ${groupId} AND word_id = ${wordId}
      AND group_id IN (SELECT id FROM english_word_groups WHERE user_id = ${userId})
  `;
}

// ── Flashcard / SRS ──────────────────────────────────────────────────────────

export async function setFlashcardActive(userId: number, wordId: number, active: boolean): Promise<void> {
  await sql`
    INSERT INTO english_flashcard (word_id, active)
    SELECT id, ${active} FROM english_words WHERE id = ${wordId} AND user_id = ${userId}
    ON CONFLICT (word_id) DO UPDATE SET active = ${active}, updated_at = NOW()
  `;
}

export async function getFlashcardsDueToday(userId: number, opts: { limit?: number; order?: "due" | "random" } = {}): Promise<FlashcardCard[]> {
  const rows = await sql`
    SELECT w.id, w.word
    FROM english_flashcard f
    JOIN english_words w ON w.id = f.word_id
    WHERE w.user_id = ${userId} AND f.active = TRUE AND f.due_date <= CURRENT_DATE
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

export interface DueForecastDay {
  date: string; // YYYY-MM-DD
  count: number;
}

// Number of active cards due on each of the next 7 days (today included).
// "Today" also absorbs any overdue cards (due_date < today), matching what
// getFlashcardsDueToday would actually serve up if reviewed today.
//
// All date math happens in SQL (Postgres CURRENT_DATE / generate_series) and
// dates are returned as plain "YYYY-MM-DD" text — deliberately avoiding any
// JS `Date` local-time arithmetic, which previously shifted every day by one
// in timezones ahead of UTC (e.g. Asia/Saigon, UTC+7): `new Date()` at local
// midnight, converted with `.toISOString()`, lands on the PREVIOUS day in UTC.
export async function getDueForecast(userId: number): Promise<DueForecastDay[]> {
  const rows = await sql`
    WITH days AS (
      SELECT generate_series(0, 6) AS offset_days
    )
    SELECT
      to_char(CURRENT_DATE + (days.offset_days || ' days')::interval, 'YYYY-MM-DD') AS date,
      (
        SELECT COUNT(*)::int
        FROM english_flashcard f
        JOIN english_words w ON w.id = f.word_id
        WHERE w.user_id = ${userId} AND f.active = TRUE
          AND (
            (days.offset_days = 0 AND f.due_date <= CURRENT_DATE)
            OR (days.offset_days > 0 AND f.due_date = CURRENT_DATE + (days.offset_days || ' days')::interval)
          )
      ) AS count
    FROM days
    ORDER BY days.offset_days
  `;
  return rows.map((r) => ({ date: r.date as string, count: r.count as number }));
}

export async function upsertFlashcardGrade(userId: number, wordId: number, grade: 0 | 1 | 2 | 3): Promise<boolean> {
  const owned = await sql`SELECT 1 FROM english_words WHERE id = ${wordId} AND user_id = ${userId}`;
  if (!owned[0]) return false;
  const rows = await sql`SELECT interval, ease_factor, repetitions FROM english_flashcard WHERE word_id = ${wordId}`;
  const { interval, easeFactor, repetitions } = calcNextInterval(
    grade,
    (rows[0]?.interval as number) ?? 1,
    (rows[0]?.ease_factor as number) ?? 2.5,
    (rows[0]?.repetitions as number) ?? 0,
  );
  // Compute the due date in SQL (CURRENT_DATE + N days) rather than with a JS
  // `Date` — `new Date()` + `.toISOString()` shifts by one day in timezones
  // ahead of UTC (e.g. Asia/Saigon, UTC+7), silently scheduling cards a day
  // off depending on what time of day the grade was submitted.
  await sql`
    INSERT INTO english_flashcard (word_id, active, due_date, interval, ease_factor, repetitions, updated_at)
    VALUES (${wordId}, TRUE, CURRENT_DATE + (${interval} || ' days')::interval, ${interval}, ${easeFactor}, ${repetitions}, NOW())
    ON CONFLICT (word_id) DO UPDATE SET
      due_date = CURRENT_DATE + (${interval} || ' days')::interval,
      interval = ${interval},
      ease_factor = ${easeFactor},
      repetitions = ${repetitions},
      updated_at = NOW()
  `;
  return true;
}

// ── Bulk import ──────────────────────────────────────────────────────────────

export async function bulkImportWords(
  userId: number,
  items: ImportWordInput[],
  groupId?: number,
  onDuplicate: "skip" | "overwrite" = "skip"
): Promise<{ created: number; overwritten: number; skipped: string[] }> {
  if (groupId) {
    const owned = await sql`SELECT 1 FROM english_word_groups WHERE id = ${groupId} AND user_id = ${userId}`;
    if (!owned[0]) throw new Error("group not found");
  }
  const existingRows = await sql`SELECT id, LOWER(word) AS w FROM english_words WHERE user_id = ${userId}`;
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
        await updateWord(userId, existingId, item.word.trim(), senses);
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
    const rows = await sql`INSERT INTO english_words (user_id, word) VALUES (${userId}, ${item.word.trim()}) RETURNING id`;
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
