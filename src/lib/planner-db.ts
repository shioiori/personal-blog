import { sql, once } from "./db";

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
  return toTask(rows[0]);
}

export async function updateTask(
  userId: number,
  id: number,
  fields: { text?: string; checked?: boolean; date?: string; endDate?: string | null }
): Promise<PlannerTask | null> {
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
  return rows[0] ? toTask(rows[0]) : null;
}

export async function deleteTask(userId: number, id: number): Promise<void> {
  await sql`DELETE FROM planner_tasks WHERE id = ${id} AND user_id = ${userId}`;
}
