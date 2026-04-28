import { sql } from "./db";
import type { UserEdits } from "@/src/components/chinese/EditCardModal";

export async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS chinese_card_state (
      char       TEXT NOT NULL PRIMARY KEY,
      hidden     BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS chinese_card_edits (
      char        TEXT NOT NULL PRIMARY KEY,
      pinyin      TEXT,
      han_viet    TEXT,
      meaning_vi  TEXT,
      note        TEXT,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
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

export async function getCardStates(): Promise<Record<string, boolean>> {
  const rows = await sql`SELECT char, hidden FROM chinese_card_state`;
  return Object.fromEntries(rows.map((r) => [r.char, r.hidden]));
}

export async function upsertCardState(char: string, hidden: boolean) {
  await sql`
    INSERT INTO chinese_card_state (char, hidden, updated_at)
    VALUES (${char}, ${hidden}, NOW())
    ON CONFLICT (char)
    DO UPDATE SET hidden = EXCLUDED.hidden, updated_at = NOW()
  `;
}

// ── Card edits (user annotations) ────────────────────────────────────────────

export async function getCardEdits(): Promise<Record<string, UserEdits>> {
  const rows = await sql`
    SELECT char, pinyin, han_viet, meaning_vi, note FROM chinese_card_edits
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

export async function upsertCardEdits(char: string, edits: UserEdits) {
  await sql`
    INSERT INTO chinese_card_edits (char, pinyin, han_viet, meaning_vi, note, updated_at)
    VALUES (
      ${char},
      ${edits.pinyin ?? null}, ${edits.hanViet ?? null},
      ${edits.meaningVi ?? null}, ${edits.note ?? null},
      NOW()
    )
    ON CONFLICT (char)
    DO UPDATE SET
      pinyin     = EXCLUDED.pinyin,
      han_viet   = EXCLUDED.han_viet,
      meaning_vi = EXCLUDED.meaning_vi,
      note       = EXCLUDED.note,
      updated_at = NOW()
  `;
}
