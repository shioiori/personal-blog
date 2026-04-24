/**
 * Seed chinese_characters table from chinese-generated.json.
 * Run: node --env-file=.env.local scripts/seed-chinese-db.mjs
 *
 * Safe to re-run — uses ON CONFLICT DO NOTHING.
 */

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL not set. Run with: node --env-file=.env.local scripts/seed-chinese-db.mjs");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

// Ensure table exists
await sql`
  CREATE TABLE IF NOT EXISTS chinese_characters (
    char         TEXT PRIMARY KEY,
    pinyin       TEXT NOT NULL DEFAULT '',
    meaning      TEXT NOT NULL DEFAULT '',
    radical      TEXT NOT NULL DEFAULT '',
    radical_name TEXT NOT NULL DEFAULT '',
    hsk          TEXT NOT NULL DEFAULT 'beyond',
    components   TEXT[] NOT NULL DEFAULT '{}',
    seeded_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

const dataPath = path.join(__dirname, "../src/data/chinese-generated.json");
const data = JSON.parse(readFileSync(dataPath, "utf8"));
const chars = Object.values(data);

console.log(`Seeding ${chars.length} characters...`);

const BATCH = 200;
let inserted = 0;
let skipped = 0;

for (let i = 0; i < chars.length; i += BATCH) {
  const batch = chars.slice(i, i + BATCH);
  for (const c of batch) {
    const result = await sql`
      INSERT INTO chinese_characters (char, pinyin, meaning, radical, radical_name, hsk, components)
      VALUES (
        ${c.char},
        ${c.pinyin ?? ""},
        ${c.meaning ?? ""},
        ${c.radical ?? ""},
        ${c.radicalName ?? ""},
        ${String(c.hsk)},
        ${c.components ?? []}
      )
      ON CONFLICT (char) DO NOTHING
      RETURNING char
    `;
    if (result.length > 0) inserted++;
    else skipped++;
  }
  process.stdout.write(`\r${Math.min(i + BATCH, chars.length)}/${chars.length} processed...`);
}

console.log(`\nDone. Inserted: ${inserted}, Skipped (already existed): ${skipped}`);

// Verify
const count = await sql`SELECT COUNT(*)::int AS n FROM chinese_characters`;
console.log(`Total rows in chinese_characters: ${count[0].n}`);
