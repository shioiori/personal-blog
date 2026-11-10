import { sql, once } from "./db";
import type {
  GapFillAnswer,
  GapFillAttempt,
  GapFillExercise,
  GapFillExerciseSummary,
  GapFillScript,
  GapFillScriptSummary,
} from "@/src/declaration/english";
import type { WordLimit } from "./gapfill-word-limit";

async function attachOrphanExercises() {
  await sql`
    UPDATE english_gapfill_exercises e SET script_id = s.id
    FROM english_gapfill_scripts s
    WHERE e.script_id IS NULL AND e.transcript IS NOT NULL AND s.user_id = e.user_id
      AND btrim(regexp_replace(s.transcript, '[[:space:]]+', ' ', 'g')) = btrim(regexp_replace(e.transcript, '[[:space:]]+', ' ', 'g'))
  `;
}

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
  await sql`
    CREATE TABLE IF NOT EXISTS english_gapfill_scripts (
      id         SERIAL PRIMARY KEY,
      user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      source     TEXT,
      transcript TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    ALTER TABLE english_gapfill_exercises ADD COLUMN IF NOT EXISTS script_id INT REFERENCES english_gapfill_scripts(id) ON DELETE CASCADE
  `;
  await sql`
    ALTER TABLE english_gapfill_exercises ALTER COLUMN transcript DROP NOT NULL
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS english_gapfill_exercises_script_idx ON english_gapfill_exercises (script_id)
  `;
  await attachOrphanExercises();
  await sql`
    INSERT INTO english_gapfill_scripts (user_id, source, transcript, created_at)
    SELECT DISTINCT ON (user_id, btrim(regexp_replace(transcript, '[[:space:]]+', ' ', 'g')))
           user_id, source, transcript, created_at
    FROM english_gapfill_exercises
    WHERE script_id IS NULL AND transcript IS NOT NULL
    ORDER BY user_id, btrim(regexp_replace(transcript, '[[:space:]]+', ' ', 'g')), (source IS NULL), created_at
  `;
  await attachOrphanExercises();
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

// ── Scripts ──────────────────────────────────────────────────────────────────

export async function listScripts(userId: number): Promise<GapFillScriptSummary[]> {
  const rows = await sql`
    SELECT s.id, s.source, s.created_at, left(btrim(regexp_replace(s.transcript, '[[:space:]]+', ' ', 'g')), 80) AS preview,
           COUNT(e.id)::int AS exercise_count
    FROM english_gapfill_scripts s
    LEFT JOIN english_gapfill_exercises e ON e.script_id = s.id
    WHERE s.user_id = ${userId}
    GROUP BY s.id
    ORDER BY s.created_at DESC
  `;
  return rows.map((r) => ({
    id: r.id as number,
    source: (r.source as string | null) ?? null,
    preview: r.preview as string,
    createdAt: (r.created_at as Date).toISOString(),
    exerciseCount: r.exercise_count as number,
  }));
}

async function listScriptExercises(scriptId: number): Promise<GapFillExerciseSummary[]> {
  const rows = await sql`
    SELECT e.id, e.title, e.word_limit, e.created_at, jsonb_array_length(e.answers) AS blank_count,
           COUNT(a.id)::int AS attempt_count, MAX(a.score) AS best_score
    FROM english_gapfill_exercises e
    LEFT JOIN english_gapfill_attempts a ON a.exercise_id = e.id
    WHERE e.script_id = ${scriptId}
    GROUP BY e.id
    ORDER BY e.created_at DESC
  `;
  return rows.map((r) => ({
    id: r.id as number,
    title: r.title as string,
    wordLimit: r.word_limit as WordLimit,
    createdAt: (r.created_at as Date).toISOString(),
    blankCount: r.blank_count as number,
    attemptCount: r.attempt_count as number,
    bestScore: (r.best_score as number | null) ?? null,
  }));
}

export async function getScript(userId: number, id: number): Promise<GapFillScript | null> {
  const rows = await sql`SELECT id, source, transcript FROM english_gapfill_scripts WHERE id = ${id} AND user_id = ${userId}`;
  if (!rows[0]) return null;
  return {
    id,
    source: (rows[0].source as string | null) ?? null,
    transcript: rows[0].transcript as string,
    exercises: await listScriptExercises(id),
  };
}

export async function getScriptTranscript(userId: number, id: number): Promise<string | null> {
  const rows = await sql`SELECT transcript FROM english_gapfill_scripts WHERE id = ${id} AND user_id = ${userId}`;
  return (rows[0]?.transcript as string | undefined) ?? null;
}

export async function findScriptByTranscript(userId: number, transcript: string): Promise<number | null> {
  const normalized = transcript.replace(/\s+/g, " ").trim();
  const rows = await sql`
    SELECT id FROM english_gapfill_scripts
    WHERE user_id = ${userId} AND btrim(regexp_replace(transcript, '[[:space:]]+', ' ', 'g')) = ${normalized}
    ORDER BY id LIMIT 1
  `;
  return (rows[0]?.id as number | undefined) ?? null;
}

export async function createScript(userId: number, transcript: string, source: string | null): Promise<number> {
  const rows = await sql`
    INSERT INTO english_gapfill_scripts (user_id, transcript, source) VALUES (${userId}, ${transcript}, ${source}) RETURNING id
  `;
  return rows[0].id as number;
}

export async function updateScriptSource(userId: number, id: number, source: string | null): Promise<void> {
  await sql`UPDATE english_gapfill_scripts SET source = ${source} WHERE id = ${id} AND user_id = ${userId}`;
}

export async function deleteScript(userId: number, id: number): Promise<void> {
  await sql`DELETE FROM english_gapfill_scripts WHERE id = ${id} AND user_id = ${userId}`;
}

export async function listScriptExerciseContents(scriptId: number): Promise<{ content: string; answers: GapFillAnswer[] }[]> {
  const rows = await sql`SELECT content, answers FROM english_gapfill_exercises WHERE script_id = ${scriptId} ORDER BY id DESC`;
  return rows.map((r) => ({ content: r.content as string, answers: r.answers as GapFillAnswer[] }));
}

// ── Exercises ────────────────────────────────────────────────────────────────

export async function createExercise(
  userId: number,
  scriptId: number,
  data: { title: string; content: string; answers: GapFillAnswer[]; wordLimit: WordLimit }
): Promise<number> {
  const rows = await sql`
    INSERT INTO english_gapfill_exercises (user_id, script_id, title, content, answers, word_limit)
    VALUES (${userId}, ${scriptId}, ${data.title}, ${data.content}, ${JSON.stringify(data.answers)}::jsonb, ${data.wordLimit})
    RETURNING id
  `;
  return rows[0].id as number;
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
    SELECT e.id, e.script_id, e.title, e.content, e.answers, e.word_limit, s.source
    FROM english_gapfill_exercises e
    JOIN english_gapfill_scripts s ON s.id = e.script_id
    WHERE e.id = ${id} AND e.user_id = ${userId}
  `;
  if (!rows[0]) return null;
  const answers = rows[0].answers as GapFillAnswer[];
  const attempts = await listAttempts(id);
  return {
    id,
    scriptId: rows[0].script_id as number,
    title: rows[0].title as string,
    source: (rows[0].source as string | null) ?? null,
    content: rows[0].content as string,
    wordLimit: rows[0].word_limit as WordLimit,
    blankCount: answers.length,
    answers: attempts.length > 0 ? answers : null,
    attempts,
  };
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
