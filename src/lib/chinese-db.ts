import { sql } from "./db";
import type { UserEdits } from "@/src/components/chinese/EditCardModal";

// ── Schema (run once) ────────────────────────────────────────────────────────
//
// CREATE TABLE IF NOT EXISTS chinese_card_state (
//   session_id TEXT NOT NULL,
//   char       TEXT NOT NULL,
//   hidden     BOOLEAN NOT NULL DEFAULT FALSE,
//   updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//   PRIMARY KEY (session_id, char)
// );
//
// CREATE TABLE IF NOT EXISTS chinese_card_edits (
//   session_id  TEXT NOT NULL,
//   char        TEXT NOT NULL,
//   pinyin      TEXT,
//   han_viet    TEXT,
//   meaning_vi  TEXT,
//   note        TEXT,
//   updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//   PRIMARY KEY (session_id, char)
// );
//
// Base character data (char, pinyin, meaning, radical, hsk, frequencyRank, ...)
// is read directly from src/data/chinese-generated.json at runtime.
// The chinese_characters DB table is managed separately by enrichment scripts.

export async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS chinese_card_state (
      session_id TEXT NOT NULL,
      char       TEXT NOT NULL,
      hidden     BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (session_id, char)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS chinese_card_edits (
      session_id  TEXT NOT NULL,
      char        TEXT NOT NULL,
      pinyin      TEXT,
      han_viet    TEXT,
      meaning_vi  TEXT,
      note        TEXT,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (session_id, char)
    )
  `;
}

// ── Card state (hidden/visible) ──────────────────────────────────────────────

export async function getCardStates(sessionId: string): Promise<Record<string, boolean>> {
  const rows = await sql`
    SELECT char, hidden FROM chinese_card_state
    WHERE session_id = ${sessionId}
  `;
  return Object.fromEntries(rows.map((r) => [r.char, r.hidden]));
}

export async function upsertCardState(
  sessionId: string,
  char: string,
  hidden: boolean
) {
  await sql`
    INSERT INTO chinese_card_state (session_id, char, hidden, updated_at)
    VALUES (${sessionId}, ${char}, ${hidden}, NOW())
    ON CONFLICT (session_id, char)
    DO UPDATE SET hidden = EXCLUDED.hidden, updated_at = NOW()
  `;
}

// ── Card edits (user annotations) ────────────────────────────────────────────

export async function getCardEdits(sessionId: string): Promise<Record<string, UserEdits>> {
  const rows = await sql`
    SELECT char, pinyin, han_viet, meaning_vi, note
    FROM chinese_card_edits
    WHERE session_id = ${sessionId}
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

export async function upsertCardEdits(
  sessionId: string,
  char: string,
  edits: UserEdits
) {
  await sql`
    INSERT INTO chinese_card_edits (session_id, char, pinyin, han_viet, meaning_vi, note, updated_at)
    VALUES (
      ${sessionId}, ${char},
      ${edits.pinyin ?? null}, ${edits.hanViet ?? null},
      ${edits.meaningVi ?? null}, ${edits.note ?? null},
      NOW()
    )
    ON CONFLICT (session_id, char)
    DO UPDATE SET
      pinyin     = EXCLUDED.pinyin,
      han_viet   = EXCLUDED.han_viet,
      meaning_vi = EXCLUDED.meaning_vi,
      note       = EXCLUDED.note,
      updated_at = NOW()
  `;
}
