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
  await sql`
    CREATE TABLE IF NOT EXISTS chinese_characters (
      char        TEXT PRIMARY KEY,
      pinyin      TEXT NOT NULL DEFAULT '',
      meaning     TEXT NOT NULL DEFAULT '',
      radical     TEXT NOT NULL DEFAULT '',
      radical_name TEXT NOT NULL DEFAULT '',
      hsk         TEXT NOT NULL DEFAULT 'beyond',
      components  TEXT[] NOT NULL DEFAULT '{}',
      seeded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

// ── Base character data (seed from chinese-generated.json) ───────────────────

export async function getCharacterCount(): Promise<number> {
  const rows = await sql`SELECT COUNT(*)::int AS n FROM chinese_characters`;
  return rows[0].n as number;
}

export async function seedCharacters(
  chars: Array<{
    char: string;
    pinyin: string;
    meaning: string;
    radical: string;
    radicalName: string;
    hsk: string;
    components: string[];
  }>
) {
  // Insert in batches of 500 to avoid query size limits
  const BATCH = 500;
  for (let i = 0; i < chars.length; i += BATCH) {
    const batch = chars.slice(i, i + BATCH);
    // Build VALUES manually — neon tagged template doesn't support array spreading
    for (const c of batch) {
      await sql`
        INSERT INTO chinese_characters (char, pinyin, meaning, radical, radical_name, hsk, components)
        VALUES (
          ${c.char}, ${c.pinyin}, ${c.meaning}, ${c.radical},
          ${c.radicalName}, ${c.hsk}, ${c.components}
        )
        ON CONFLICT (char) DO NOTHING
      `;
    }
  }
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
