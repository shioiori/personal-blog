import { sql, once } from "./db";

export interface PlannerTask {
  id: number;
  date: string;
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
  await sql`CREATE INDEX IF NOT EXISTS planner_tasks_user_date_idx ON planner_tasks (user_id, date)`;
});

function toTask(row: Record<string, unknown>): PlannerTask {
  const date = row.date as Date;
  return {
    id: row.id as number,
    date: date.toISOString().slice(0, 10),
    text: row.text as string,
    checked: row.checked as boolean
  };
}

export async function listTasks(userId: number, from: string, to: string): Promise<PlannerTask[]> {
  const rows = await sql`
    SELECT id, date, text, checked FROM planner_tasks
    WHERE user_id = ${userId} AND date >= ${from} AND date <= ${to}
    ORDER BY date ASC, id ASC
  `;
  return rows.map(toTask);
}

export async function createTask(userId: number, date: string, text: string, checked: boolean): Promise<PlannerTask> {
  const rows = await sql`
    INSERT INTO planner_tasks (user_id, date, text, checked)
    VALUES (${userId}, ${date}, ${text}, ${checked})
    RETURNING id, date, text, checked
  `;
  return toTask(rows[0]);
}

export async function updateTask(userId: number, id: number, fields: { text?: string; checked?: boolean }): Promise<PlannerTask | null> {
  const rows = await sql`
    UPDATE planner_tasks
    SET text = COALESCE(${fields.text ?? null}, text),
        checked = COALESCE(${fields.checked ?? null}, checked)
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING id, date, text, checked
  `;
  return rows[0] ? toTask(rows[0]) : null;
}

export async function deleteTask(userId: number, id: number): Promise<void> {
  await sql`DELETE FROM planner_tasks WHERE id = ${id} AND user_id = ${userId}`;
}
