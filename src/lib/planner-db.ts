import { sql, once } from "./db";
import type { ParsedTask } from "./planner-text";
import { adjustBalance, ensureGardenTables } from "./garden-db";
import { TASK_REWARD_PER_DAY } from "./garden-catalog";

export interface PlannerTask {
  id: number;
  date: string;
  endDate: string | null;
  text: string;
  checked: boolean;
}

export const ensurePlannerTables = once(async function ensurePlannerTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS planner_tasks (
      id         SERIAL PRIMARY KEY,
      user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date       DATE NOT NULL,
      text       TEXT NOT NULL,
      checked    BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE planner_tasks ADD COLUMN IF NOT EXISTS end_date DATE`;
  await sql`CREATE INDEX IF NOT EXISTS planner_tasks_user_date_idx ON planner_tasks (user_id, date)`;
});

/** Garden coins a checked task is worth: a fixed amount per day it spans. */
export function taskReward(task: { date: string; endDate: string | null; checked: boolean }): number {
  if (!task.checked) return 0;
  if (!task.endDate) return TASK_REWARD_PER_DAY;
  const a = new Date(task.date + "T00:00:00Z").getTime();
  const b = new Date(task.endDate + "T00:00:00Z").getTime();
  return Math.max(1, Math.floor((b - a) / 86400000) + 1) * TASK_REWARD_PER_DAY;
}

async function payReward(userId: number, delta: number): Promise<void> {
  if (delta === 0) return;
  await ensureGardenTables();
  await adjustBalance(userId, delta);
}

async function getTask(userId: number, id: number): Promise<PlannerTask | null> {
  const rows = await sql`
    SELECT id, date::text AS date, end_date::text AS end_date, text, checked FROM planner_tasks
    WHERE id = ${id} AND user_id = ${userId}
  `;
  return rows[0] ? toTask(rows[0]) : null;
}

function toTask(row: Record<string, unknown>): PlannerTask {
  return {
    id: row.id as number,
    date: row.date as string,
    endDate: row.end_date as string | null,
    text: row.text as string,
    checked: row.checked as boolean
  };
}

export async function listTasks(userId: number, from: string, to: string): Promise<PlannerTask[]> {
  const rows = await sql`
    SELECT id, date::text AS date, end_date::text AS end_date, text, checked FROM planner_tasks
    WHERE user_id = ${userId} AND date <= ${to} AND COALESCE(end_date, date) >= ${from}
    ORDER BY date ASC, id ASC
  `;
  return rows.map(toTask);
}

export async function listLatestTasksBefore(userId: number, date: string): Promise<PlannerTask[]> {
  const rows = await sql`
    SELECT id, date::text AS date, end_date::text AS end_date, text, checked FROM planner_tasks
    WHERE user_id = ${userId} AND end_date IS NULL
      AND date = (SELECT MAX(date) FROM planner_tasks WHERE user_id = ${userId} AND end_date IS NULL AND date < ${date})
    ORDER BY id ASC
  `;
  return rows.map(toTask);
}

export async function createTask(userId: number, date: string, endDate: string | null, text: string, checked: boolean): Promise<PlannerTask> {
  const rows = await sql`
    INSERT INTO planner_tasks (user_id, date, end_date, text, checked)
    VALUES (${userId}, ${date}, ${endDate}, ${text}, ${checked})
    RETURNING id, date::text AS date, end_date::text AS end_date, text, checked
  `;
  const task = toTask(rows[0]);
  await payReward(userId, taskReward(task));
  return task;
}

export async function updateTask(
  userId: number,
  id: number,
  fields: { text?: string; checked?: boolean; date?: string; endDate?: string | null }
): Promise<PlannerTask | null> {
  const before = await getTask(userId, id);
  if (!before) return null;
  const date = fields.date ?? null;
  const rows = await sql`
    UPDATE planner_tasks
    SET text = COALESCE(${fields.text ?? null}, text),
        checked = COALESCE(${fields.checked ?? null}, checked),
        date = COALESCE(${date}::date, date),
        end_date = CASE WHEN ${date}::date IS NULL THEN end_date ELSE ${fields.endDate ?? null}::date END
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING id, date::text AS date, end_date::text AS end_date, text, checked
  `;
  const task = rows[0] ? toTask(rows[0]) : null;
  // Ticking pays, unticking takes it back, and moving a checked task re-prices it by its new length.
  if (task) await payReward(userId, taskReward(task) - taskReward(before));
  return task;
}

export async function deleteTask(userId: number, id: number): Promise<void> {
  const rows = await sql`
    DELETE FROM planner_tasks WHERE id = ${id} AND user_id = ${userId}
    RETURNING date::text AS date, end_date::text AS end_date, checked
  `;
  if (rows[0]) await payReward(userId, -taskReward(toTask(rows[0])));
}

export async function syncTasks(userId: number, from: string, to: string, parsed: ParsedTask[]): Promise<void> {
  const pool = await listTasks(userId, from, to);
  // The range is replaced wholesale, so the wallet changes by (rewards after) - (rewards before).
  const rewardDelta =
    parsed.reduce((sum, p) => sum + taskReward(p), 0) - pool.reduce((sum, e) => sum + taskReward(e), 0);
  const sameGroup = (a: ParsedTask, b: ParsedTask) => a.date === b.date && a.endDate === b.endDate;
  const pairs: [PlannerTask, ParsedTask][] = [];
  let pending = parsed;
  for (const match of [
    (e: PlannerTask, p: ParsedTask) => sameGroup(e, p) && e.text === p.text,
    (e: PlannerTask, p: ParsedTask) => e.text === p.text,
    sameGroup
  ]) {
    pending = pending.filter((p) => {
      const i = pool.findIndex((e) => match(e, p));
      if (i < 0) return true;
      pairs.push([pool.splice(i, 1)[0], p]);
      return false;
    });
  }

  const queries = [
    ...pairs
      .filter(([e, p]) => e.text !== p.text || e.checked !== p.checked || !sameGroup(e, p))
      .map(([e, p]) => sql`
        UPDATE planner_tasks SET text = ${p.text}, checked = ${p.checked}, date = ${p.date}, end_date = ${p.endDate}
        WHERE id = ${e.id} AND user_id = ${userId}
      `),
    ...pending.map((p) => sql`
      INSERT INTO planner_tasks (user_id, date, end_date, text, checked)
      VALUES (${userId}, ${p.date}, ${p.endDate}, ${p.text}, ${p.checked})
    `),
    ...(pool.length ? [sql`DELETE FROM planner_tasks WHERE user_id = ${userId} AND id = ANY(${pool.map((e) => e.id)})`] : [])
  ];
  if (queries.length) await sql.transaction(queries);
  await payReward(userId, rewardDelta);
}
