import { sql, once } from "./db";
import type { GapFillAnswer, GapFillAttempt, GapFillExercise, GapFillExerciseSummary } from "@/src/declaration/english";
import type { WordLimit } from "./gapfill-word-limit";

export const ensureGapFillTables = once(async function ensureGapFillTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS english_gapfill_exercises (
      id         SERIAL PRIMARY KEY,
      user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title      TEXT NOT NULL,
      transcript TEXT NOT NULL,
      content    TEXT NOT NULL,
      answers    JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    ALTER TABLE english_gapfill_exercises ADD COLUMN IF NOT EXISTS word_limit TEXT NOT NULL DEFAULT 'two_number'
  `;
  await sql`
    ALTER TABLE english_gapfill_exercises ADD COLUMN IF NOT EXISTS source TEXT
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS english_gapfill_attempts (
      id          SERIAL PRIMARY KEY,
      exercise_id INT NOT NULL REFERENCES english_gapfill_exercises(id) ON DELETE CASCADE,
      responses   JSONB NOT NULL,
      results     JSONB NOT NULL,
      score       INT NOT NULL,
      total       INT NOT NULL
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS english_gapfill_attempts_exercise_idx ON english_gapfill_attempts (exercise_id)
  `;
});

function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[\s.,;:!?"'()]+|[\s.,;:!?"'()]+$/g, "");
}

function gradeResponses(answers: GapFillAnswer[], responses: string[]): boolean[] {
  return answers.map((a, i) => {
    const given = normalizeAnswer(responses[i] ?? "");
    return given !== "" && [a.answer, ...a.alternatives].some((accepted) => normalizeAnswer(accepted) === given);
  });
}

const MAX_SOURCE_LENGTH = 500;

export function normalizeSource(value: unknown): string | null {
  const source = typeof value === "string" ? value.trim().slice(0, MAX_SOURCE_LENGTH) : "";
  return source || null;
}

export async function createExercise(
  userId: number,
  data: { title: string; transcript: string; content: string; answers: GapFillAnswer[]; wordLimit: WordLimit; source: string | null }
): Promise<number> {
  const rows = await sql`
    INSERT INTO english_gapfill_exercises (user_id, title, transcript, content, answers, word_limit, source)
    VALUES (${userId}, ${data.title}, ${data.transcript}, ${data.content}, ${JSON.stringify(data.answers)}::jsonb, ${data.wordLimit}, ${data.source})
    RETURNING id
  `;
  return rows[0].id as number;
}

export async function listExercises(userId: number): Promise<GapFillExerciseSummary[]> {
  const rows = await sql`
    SELECT e.id, e.title, e.source, e.created_at, jsonb_array_length(e.answers) AS blank_count,
           COUNT(a.id)::int AS attempt_count, MAX(a.score) AS best_score
    FROM english_gapfill_exercises e
    LEFT JOIN english_gapfill_attempts a ON a.exercise_id = e.id
    WHERE e.user_id = ${userId}
    GROUP BY e.id
    ORDER BY e.created_at DESC
  `;
  return rows.map((r) => ({
    id: r.id as number,
    title: r.title as string,
    source: (r.source as string | null) ?? null,
    createdAt: (r.created_at as Date).toISOString(),
    blankCount: r.blank_count as number,
    attemptCount: r.attempt_count as number,
    bestScore: (r.best_score as number | null) ?? null,
  }));
}

async function listAttempts(exerciseId: number): Promise<GapFillAttempt[]> {
  const rows = await sql`
    SELECT id, responses, results, score, total FROM english_gapfill_attempts
    WHERE exercise_id = ${exerciseId} ORDER BY id
  `;
  return rows.map((r) => ({
    id: r.id as number,
    responses: r.responses as string[],
    results: r.results as boolean[],
    score: r.score as number,
    total: r.total as number,
  }));
}

export async function getExercise(userId: number, id: number): Promise<GapFillExercise | null> {
  const rows = await sql`
    SELECT id, title, source, content, answers, word_limit FROM english_gapfill_exercises WHERE id = ${id} AND user_id = ${userId}
  `;
  if (!rows[0]) return null;
  const answers = rows[0].answers as GapFillAnswer[];
  const attempts = await listAttempts(id);
  return {
    id,
    title: rows[0].title as string,
    source: (rows[0].source as string | null) ?? null,
    content: rows[0].content as string,
    wordLimit: rows[0].word_limit as WordLimit,
    blankCount: answers.length,
    answers: attempts.length > 0 ? answers : null,
    attempts,
  };
}

export async function updateExerciseSource(userId: number, id: number, source: string | null): Promise<void> {
  await sql`UPDATE english_gapfill_exercises SET source = ${source} WHERE id = ${id} AND user_id = ${userId}`;
}

export async function deleteExercise(userId: number, id: number): Promise<void> {
  await sql`DELETE FROM english_gapfill_exercises WHERE id = ${id} AND user_id = ${userId}`;
}

export async function submitAttempt(
  userId: number,
  id: number,
  responses: string[]
): Promise<{ attempt: GapFillAttempt; answers: GapFillAnswer[] } | null> {
  const rows = await sql`SELECT answers FROM english_gapfill_exercises WHERE id = ${id} AND user_id = ${userId}`;
  if (!rows[0]) return null;
  const answers = rows[0].answers as GapFillAnswer[];
  const normalizedResponses = answers.map((_, i) => String(responses[i] ?? "").trim());
  const results = gradeResponses(answers, normalizedResponses);
  const score = results.filter(Boolean).length;
  const inserted = await sql`
    INSERT INTO english_gapfill_attempts (exercise_id, responses, results, score, total)
    VALUES (${id}, ${JSON.stringify(normalizedResponses)}::jsonb, ${JSON.stringify(results)}::jsonb, ${score}, ${answers.length})
    RETURNING id
  `;
  return {
    attempt: { id: inserted[0].id as number, responses: normalizedResponses, results, score, total: answers.length },
    answers,
  };
}
