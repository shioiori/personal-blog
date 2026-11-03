/**
 * Create the default account and link all existing study data to it.
 * Run: node --env-file=.env.local scripts/seed-user.mjs
 *
 * Safe to re-run.
 */

import { neon } from "@neondatabase/serverless";
import { randomBytes, scryptSync } from "crypto";

const EMAIL = "clara@yopmail.com";
const PASSWORD = "123456";

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL not set. Run with: node --env-file=.env.local scripts/seed-user.mjs");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

await sql`
  CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;
await sql`
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
  )
`;

const salt = randomBytes(16).toString("hex");
const passwordHash = `${salt}:${scryptSync(PASSWORD, salt, 64).toString("hex")}`;
await sql`INSERT INTO users (email, password_hash) VALUES (${EMAIL}, ${passwordHash}) ON CONFLICT (email) DO NOTHING`;
const userId = (await sql`SELECT id FROM users WHERE email = ${EMAIL}`)[0].id;
console.log(`User ${EMAIL} -> id ${userId}`);

const TABLES = {
  english_words: [],
  english_word_groups: [
    "DROP CONSTRAINT IF EXISTS english_word_groups_name_key",
    "DROP CONSTRAINT IF EXISTS english_word_groups_user_name_key",
    "ADD CONSTRAINT english_word_groups_user_name_key UNIQUE (user_id, name)",
  ],
  english_settings: [
    "DROP CONSTRAINT IF EXISTS english_settings_pkey",
    "ADD CONSTRAINT english_settings_pkey PRIMARY KEY (user_id, key)",
  ],
  english_gacha_state: [
    "DROP CONSTRAINT IF EXISTS english_gacha_state_singleton",
    "DROP CONSTRAINT IF EXISTS english_gacha_state_pkey",
    "DROP COLUMN IF EXISTS id",
    "ADD CONSTRAINT english_gacha_state_pkey PRIMARY KEY (user_id)",
  ],
  chinese_card_state: [
    "DROP CONSTRAINT IF EXISTS chinese_card_state_pkey",
    "ADD CONSTRAINT chinese_card_state_pkey PRIMARY KEY (user_id, char)",
  ],
  chinese_card_edits: [
    "DROP CONSTRAINT IF EXISTS chinese_card_edits_pkey",
    "ADD CONSTRAINT chinese_card_edits_pkey PRIMARY KEY (user_id, char)",
  ],
  chinese_flashcard_flip: [
    "DROP CONSTRAINT IF EXISTS chinese_flashcard_flip_pkey",
    "ADD CONSTRAINT chinese_flashcard_flip_pkey PRIMARY KEY (user_id, char)",
  ],
  chinese_flashcard_write: [
    "DROP CONSTRAINT IF EXISTS chinese_flashcard_write_pkey",
    "ADD CONSTRAINT chinese_flashcard_write_pkey PRIMARY KEY (user_id, char)",
  ],
  compound_categories: [
    "DROP CONSTRAINT IF EXISTS compound_categories_name_key",
    "DROP CONSTRAINT IF EXISTS compound_categories_user_name_key",
    "ADD CONSTRAINT compound_categories_user_name_key UNIQUE (user_id, name)",
  ],
  compound_words: [],
  char_groups: [
    "DROP CONSTRAINT IF EXISTS char_groups_name_key",
    "DROP CONSTRAINT IF EXISTS char_groups_user_name_key",
    "ADD CONSTRAINT char_groups_user_name_key UNIQUE (user_id, name)",
  ],
  chinese_review_history: [],
  chinese_user_texts: [],
  grammar_posts: [],
};

const queries = [];
for (const [table, alters] of Object.entries(TABLES)) {
  const exists = (await sql`SELECT to_regclass(${table}) AS t`)[0].t;
  if (!exists) {
    console.log(`skip ${table} (not created yet)`);
    continue;
  }
  queries.push(sql.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id) ON DELETE CASCADE`));
  queries.push(sql.query(`UPDATE ${table} SET user_id = $1 WHERE user_id IS NULL`, [userId]));
  queries.push(sql.query(`ALTER TABLE ${table} ALTER COLUMN user_id SET NOT NULL`));
  for (const alter of alters) queries.push(sql.query(`ALTER TABLE ${table} ${alter}`));
  console.log(`link ${table}`);
}

await sql.transaction(queries);
console.log("Done.");
