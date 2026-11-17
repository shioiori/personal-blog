import { sql, once } from "./db";
import type { ParsedTask } from "./planner-text";
import { adjustBalance, ensureGardenTables } from "./garden-db";
import { TASK_REWARD_PER_DAY } from "./garden-catalog";

export type PlannerStatus = "undone" | "partial" | "done";

export interface PlannerTask {
  id: number;
  date: string;
  endDate: string | null;
  text: string;
  status: PlannerStatus;
  categoryId: number | null;
  parentId: number | null;
  position: number;
}

export interface PlannerCategory {
  id: number;
  name: string;
  color: string;
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
  await sql`
    CREATE TABLE IF NOT EXISTS planner_categories (
      id         SERIAL PRIMARY KEY,
      user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      color      TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE planner_tasks ADD COLUMN IF NOT EXISTS category_id INT REFERENCES planner_categories(id) ON DELETE SET NULL`;
  await sql`ALTER TABLE planner_tasks ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'undone'`;
  await sql`ALTER TABLE planner_tasks ADD COLUMN IF NOT EXISTS parent_id INT REFERENCES planner_tasks(id) ON DELETE CASCADE`;
  await sql`CREATE INDEX IF NOT EXISTS planner_tasks_parent_idx ON planner_tasks (parent_id)`;
  await sql`ALTER TABLE planner_tasks ADD COLUMN IF NOT EXISTS position INT NOT NULL DEFAULT 0`;
  // One-time migration off the old `checked` boolean, kept idempotent via IF EXISTS checks.
  await sql`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'planner_tasks' AND column_name = 'checked') THEN
        UPDATE planner_tasks SET status = 'done' WHERE checked IS TRUE;
        ALTER TABLE planner_tasks DROP COLUMN checked;
      END IF;
    END $$;
  `;
});

export async function listCategories(userId: number): Promise<PlannerCategory[]> {
  const rows = await sql`
    SELECT id, name, color FROM planner_categories WHERE user_id = ${userId} ORDER BY id ASC
  `;
  return rows.map((r) => ({ id: r.id as number, name: r.name as string, color: r.color as string }));
}

export async function createCategory(userId: number, name: string, color: string): Promise<PlannerCategory> {
  const rows = await sql`
    INSERT INTO planner_categories (user_id, name, color) VALUES (${userId}, ${name}, ${color})
    RETURNING id, name, color
  `;
  return { id: rows[0].id as number, name: rows[0].name as string, color: rows[0].color as string };
}

export async function deleteCategory(userId: number, id: number): Promise<void> {
  await sql`DELETE FROM planner_categories WHERE id = ${id} AND user_id = ${userId}`;
}

/** Garden coins a task is worth: a fixed amount per day it spans, paid only once fully done. */
export function taskReward(task: { date: string; endDate: string | null; status: PlannerStatus }): number {
  if (task.status !== "done") return 0;
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
    SELECT id, date::text AS date, end_date::text AS end_date, text, status, category_id, parent_id, position FROM planner_tasks
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
    status: row.status as PlannerStatus,
    categoryId: (row.category_id as number | null) ?? null,
    parentId: (row.parent_id as number | null) ?? null,
    position: row.position as number
  };
}

export async function listTasks(userId: number, from: string, to: string): Promise<PlannerTask[]> {
  const rows = await sql`
    SELECT id, date::text AS date, end_date::text AS end_date, text, status, category_id, parent_id, position FROM planner_tasks
    WHERE user_id = ${userId} AND date <= ${to} AND COALESCE(end_date, date) >= ${from}
    ORDER BY position ASC, date ASC, id ASC
  `;
  return rows.map(toTask);
}

export async function listLatestTasksBefore(userId: number, date: string): Promise<PlannerTask[]> {
  const rows = await sql`
    SELECT id, date::text AS date, end_date::text AS end_date, text, status, category_id, parent_id, position FROM planner_tasks
    WHERE user_id = ${userId} AND end_date IS NULL
      AND date = (SELECT MAX(date) FROM planner_tasks WHERE user_id = ${userId} AND end_date IS NULL AND date < ${date})
    ORDER BY position ASC, id ASC
  `;
  return rows.map(toTask);
}

export async function createTask(
  userId: number,
  date: string,
  endDate: string | null,
  text: string,
  status: PlannerStatus,
  parentId: number | null = null
): Promise<PlannerTask> {
  let parent: PlannerTask | null = null;
  if (parentId !== null) {
    parent = await getTask(userId, parentId);
    if (!parent || parent.parentId !== null) throw new Error("invalid parent");
  }
  // Subtasks always track their parent's start date and have no range of their own.
  const taskDate = parent ? parent.date : date;
  const taskEndDate = parent ? null : endDate;
  const rows = await sql`
    INSERT INTO planner_tasks (user_id, date, end_date, text, status, parent_id, position)
    VALUES (
      ${userId}, ${taskDate}, ${taskEndDate}, ${text}, ${status}, ${parentId},
      COALESCE((SELECT MAX(position) + 1 FROM planner_tasks WHERE user_id = ${userId}), 0)
    )
    RETURNING id, date::text AS date, end_date::text AS end_date, text, status, category_id, parent_id, position
  `;
  const task = toTask(rows[0]);
  await payReward(userId, taskReward(task));
  return task;
}

export async function updateTask(
  userId: number,
  id: number,
  fields: { text?: string; status?: PlannerStatus; date?: string; endDate?: string | null; categoryId?: number | null }
): Promise<PlannerTask | null> {
  const before = await getTask(userId, id);
  if (!before) return null;
  // A task with children can't move/resize independently of its parent and shouldn't gain a category.
  const date = before.parentId === null ? fields.date ?? null : null;
  const categoryId =
    before.parentId !== null ? null : fields.categoryId !== undefined ? fields.categoryId : before.categoryId;
  const rows = await sql`
    UPDATE planner_tasks
    SET text = COALESCE(${fields.text ?? null}, text),
        status = COALESCE(${fields.status ?? null}, status),
        date = COALESCE(${date}::date, date),
        end_date = CASE WHEN ${date}::date IS NULL THEN end_date ELSE ${fields.endDate ?? null}::date END,
        category_id = ${categoryId}
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING id, date::text AS date, end_date::text AS end_date, text, status, category_id, parent_id, position
  `;
  const task = rows[0] ? toTask(rows[0]) : null;
  if (task && task.parentId === null && task.date !== before.date) {
    await sql`UPDATE planner_tasks SET date = ${task.date} WHERE parent_id = ${id} AND user_id = ${userId}`;
  }
  // Status changes pay/claw back the reward; moving a done task re-prices it by its new length.
  if (task) await payReward(userId, taskReward(task) - taskReward(before));
  return task;
}

export async function deleteTask(userId: number, id: number): Promise<void> {
  // Subtasks are deleted along with their parent via ON DELETE CASCADE; refund both.
  const children = await sql`
    SELECT date::text AS date, end_date::text AS end_date, status FROM planner_tasks WHERE parent_id = ${id} AND user_id = ${userId}
  `;
  const rows = await sql`
    DELETE FROM planner_tasks WHERE id = ${id} AND user_id = ${userId}
    RETURNING date::text AS date, end_date::text AS end_date, status
  `;
  if (!rows[0]) return;
  const refund = [...rows, ...children].reduce(
    (sum, r) => sum - taskReward({ date: r.date as string, endDate: r.end_date as string | null, status: r.status as PlannerStatus }),
    0
  );
  await payReward(userId, refund);
}

export async function reorderTasks(userId: number, ids: number[]): Promise<void> {
  await sql`
    UPDATE planner_tasks t SET position = o.ord
    FROM unnest(${ids}::int[]) WITH ORDINALITY AS o(id, ord)
    WHERE t.id = o.id AND t.user_id = ${userId}
  `;
}

export async function syncTasks(userId: number, from: string, to: string, parsed: ParsedTask[]): Promise<void> {
  const pool = (await listTasks(userId, from, to)).filter((t) => t.parentId === null);
  const order = new Map(parsed.map((p, i) => [p, i]));
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
      .filter(([e, p]) => e.text !== p.text || e.status !== p.status || !sameGroup(e, p) || e.position !== order.get(p))
      .map(([e, p]) => sql`
        UPDATE planner_tasks
        SET text = ${p.text}, status = ${p.status}, date = ${p.date}, end_date = ${p.endDate}, position = ${order.get(p)}
        WHERE id = ${e.id} AND user_id = ${userId}
      `),
    ...pending.map((p) => sql`
      INSERT INTO planner_tasks (user_id, date, end_date, text, status, position)
      VALUES (${userId}, ${p.date}, ${p.endDate}, ${p.text}, ${p.status}, ${order.get(p)})
    `),
    // Deleting a replaced top-level task also drops its subtasks via ON DELETE CASCADE.
    ...(pool.length ? [sql`DELETE FROM planner_tasks WHERE user_id = ${userId} AND id = ANY(${pool.map((e) => e.id)})`] : [])
  ];
  if (queries.length) await sql.transaction(queries);
  await payReward(userId, rewardDelta);
}
