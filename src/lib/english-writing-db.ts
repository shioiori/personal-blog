import { sql, once } from "./db";
import { calcNextInterval } from "./english-db";
import type { WritingCard, WritingGrade } from "@/src/declaration/english";

// Writing-mode SRS progress, tracked independently of the regular flashcard
// table (english_flashcard) — remembering a word by writing a sentence with
// it is a different skill from recognizing it on a flip, so the two modes
// schedule separately. A word with no row here is treated as active and due
// today (see getWritingDueToday / upsertWritingGrade), matching how a brand
// new word behaves before its first review.
export const ensureWritingTables = once(async function ensureWritingTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS english_writing_flashcard (
      word_id     INT PRIMARY KEY REFERENCES english_words(id) ON DELETE CASCADE,
      active      BOOLEAN NOT NULL DEFAULT TRUE,
      due_date    DATE NOT NULL DEFAULT CURRENT_DATE,
      interval    INT NOT NULL DEFAULT 1,
      ease_factor REAL NOT NULL DEFAULT 2.5,
      repetitions INT NOT NULL DEFAULT 0,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
});

// Words with no row are active by default (see getWritingDueToday), so only
// explicit overrides are returned here — callers should default to `true`.
export async function getWritingActiveOverrides(userId: number): Promise<Record<number, boolean>> {
  const rows = await sql`
    SELECT f.word_id, f.active FROM english_writing_flashcard f
    JOIN english_words w ON w.id = f.word_id
    WHERE w.user_id = ${userId}
  `;
  return Object.fromEntries(rows.map((r) => [r.word_id as number, r.active as boolean]));
}

export async function setWritingActive(userId: number, wordIds: number[], active: boolean): Promise<void> {
  await sql`
    INSERT INTO english_writing_flashcard (word_id, active)
    SELECT id, ${active} FROM english_words WHERE id = ANY(${wordIds}) AND user_id = ${userId}
    ON CONFLICT (word_id) DO UPDATE SET active = ${active}, updated_at = NOW()
  `;
}

export async function getWritingDueToday(userId: number, opts: { limit?: number; order?: "due" | "random" } = {}): Promise<WritingCard[]> {
  const rows = await sql`
    SELECT w.id, w.word,
      COALESCE(f.due_date, CURRENT_DATE) AS due_date
    FROM english_words w
    LEFT JOIN english_writing_flashcard f ON f.word_id = w.id
    WHERE w.user_id = ${userId}
      AND COALESCE(f.active, TRUE) = TRUE
      AND COALESCE(f.due_date, CURRENT_DATE) <= CURRENT_DATE
      AND w.origin_word_id IS NULL
    ORDER BY due_date ASC
  `;
  let cards = rows.map((r) => ({ wordId: r.id as number, word: r.word as string }));
  if (opts.order === "random") cards = cards.sort(() => Math.random() - 0.5);
  if (opts.limit && opts.limit > 0) cards = cards.slice(0, opts.limit);
  if (cards.length === 0) return [];

  const ids = cards.map((c) => c.wordId);
  const senseRows = await sql`
    SELECT word_id, meaning_vi, example FROM english_senses
    WHERE word_id = ANY(${ids}) AND COALESCE(meaning_vi, '') <> ''
    ORDER BY sort_order ASC, id ASC
  `;
  const meaningsByWord = new Map<number, string[]>();
  const exampleByWord = new Map<number, string>();
  for (const r of senseRows) {
    const wid = r.word_id as number;
    const meaning = (r.meaning_vi as string | null)?.trim();
    if (meaning) {
      if (!meaningsByWord.has(wid)) meaningsByWord.set(wid, []);
      meaningsByWord.get(wid)!.push(meaning);
    }
    const example = (r.example as string | null)?.trim();
    if (example && !exampleByWord.has(wid)) exampleByWord.set(wid, example);
  }

  // A word with no Vietnamese meaning yet can't be used for this mode (there's
  // nothing to show on the front of the card).
  return cards
    .filter((c) => meaningsByWord.has(c.wordId))
    .map((c) => ({
      wordId: c.wordId,
      word: c.word,
      meaningVi: meaningsByWord.get(c.wordId)!.join("; "),
      example: exampleByWord.get(c.wordId) ?? "",
    }));
}

export interface WritingDueForecastDay {
  date: string;
  count: number;
}

export async function getWritingDueForecast(userId: number): Promise<WritingDueForecastDay[]> {
  const rows = await sql`
    WITH days AS (
      SELECT generate_series(0, 6) AS offset_days
    )
    SELECT
      to_char(CURRENT_DATE + (days.offset_days || ' days')::interval, 'YYYY-MM-DD') AS date,
      (
        SELECT COUNT(*)::int
        FROM english_words w
        LEFT JOIN english_writing_flashcard f ON f.word_id = w.id
        WHERE w.user_id = ${userId} AND COALESCE(f.active, TRUE) = TRUE
          AND EXISTS (SELECT 1 FROM english_senses s WHERE s.word_id = w.id AND COALESCE(s.meaning_vi, '') <> '')
          AND (
            (days.offset_days = 0 AND COALESCE(f.due_date, CURRENT_DATE) <= CURRENT_DATE)
            OR (days.offset_days > 0 AND COALESCE(f.due_date, CURRENT_DATE) = CURRENT_DATE + (days.offset_days || ' days')::interval)
          )
      ) AS count
    FROM days
    ORDER BY days.offset_days
  `;
  return rows.map((r) => ({ date: r.date as string, count: r.count as number }));
}

export async function upsertWritingGrade(userId: number, wordId: number, grade: WritingGrade): Promise<boolean> {
  const owned = await sql`SELECT 1 FROM english_words WHERE id = ${wordId} AND user_id = ${userId}`;
  if (!owned[0]) return false;
  const rows = await sql`SELECT interval, ease_factor, repetitions FROM english_writing_flashcard WHERE word_id = ${wordId}`;
  const { interval, easeFactor, repetitions } = calcNextInterval(
    grade,
    (rows[0]?.interval as number) ?? 1,
    (rows[0]?.ease_factor as number) ?? 2.5,
    (rows[0]?.repetitions as number) ?? 0,
  );
  await sql`
    INSERT INTO english_writing_flashcard (word_id, active, due_date, interval, ease_factor, repetitions, updated_at)
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
