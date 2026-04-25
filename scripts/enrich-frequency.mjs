/**
 * Enrich chinese-generated.json with frequency ranks from hanziDB.csv (Jun Da's list).
 * Only processes HSK 1–6 characters.
 *
 * Also:
 *   - Adds frequency_rank column to chinese_characters table (if missing)
 *   - Upserts HSK 1–6 rows with full data + frequency_rank into the DB
 *
 * Run: node scripts/enrich-frequency.mjs
 * Requires: DATABASE_URL in .env.local
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const RAW = path.join(ROOT, "src/data/raw");
const JSON_PATH = path.join(ROOT, "src/data/chinese-generated.json");

// ── Load .env.local (worktree root first, then parent project root) ───────────
const envPath = fs.existsSync(path.join(ROOT, ".env.local"))
  ? path.join(ROOT, ".env.local")
  : path.join(ROOT, "../../../.env.local"); // main project root
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

if (!process.env.DATABASE_URL) {
  console.error("❌  DATABASE_URL not set");
  process.exit(1);
}

// ── 1. Parse hanziDB.csv → Map<char, frequencyRank> ──────────────────────────
console.log("Parsing hanzidb.csv...");
const csvLines = fs.readFileSync(path.join(RAW, "hanzidb.csv"), "utf8").split("\n");
const freqMap = new Map(); // char → rank (integer)

for (const line of csvLines.slice(1)) { // skip header
  if (!line.trim()) continue;
  // CSV: frequency_rank,character,pinyin,...
  const firstComma = line.indexOf(",");
  const secondComma = line.indexOf(",", firstComma + 1);
  const rank = parseInt(line.slice(0, firstComma));
  const char = line.slice(firstComma + 1, secondComma);
  if (char && !isNaN(rank)) freqMap.set(char, rank);
}
console.log(`Loaded ${freqMap.size} frequency entries`);

// ── 2. Load chinese-generated.json ───────────────────────────────────────────
console.log("Loading chinese-generated.json...");
const data = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
const allChars = Object.values(data);
const hskChars = allChars.filter((c) => c.hsk !== "beyond");
console.log(`HSK 1–6 chars: ${hskChars.length}`);

// ── 3. Enrich JSON with frequencyRank ────────────────────────────────────────
let enriched = 0;
let missing = 0;
for (const c of hskChars) {
  const rank = freqMap.get(c.char);
  if (rank != null) {
    data[c.char].frequencyRank = rank;
    enriched++;
  } else {
    data[c.char].frequencyRank = null;
    missing++;
  }
}
console.log(`Enriched: ${enriched} | Not in hanziDB: ${missing}`);

fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 0), "utf8");
console.log(`✅  chinese-generated.json updated`);

// ── 4. Update DB ──────────────────────────────────────────────────────────────
console.log("\nConnecting to Neon DB...");
const { neon } = await import("@neondatabase/serverless");
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
    frequency_rank INTEGER,
    seeded_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

// Add frequency_rank column if it doesn't exist yet
try {
  await sql`ALTER TABLE chinese_characters ADD COLUMN IF NOT EXISTS frequency_rank INTEGER`;
  console.log("frequency_rank column ensured");
} catch (e) {
  console.log("frequency_rank column already exists or error:", e.message);
}

// Upsert HSK 1–6 rows with frequency_rank
console.log(`Upserting ${hskChars.length} HSK 1–6 rows...`);
let upserted = 0;
for (const c of hskChars) {
  const entry = data[c.char];
  await sql`
    INSERT INTO chinese_characters (char, pinyin, meaning, radical, radical_name, hsk, components, frequency_rank)
    VALUES (
      ${entry.char},
      ${entry.pinyin},
      ${entry.meaning},
      ${entry.radical},
      ${entry.radicalName},
      ${String(entry.hsk)},
      ${entry.components},
      ${entry.frequencyRank ?? null}
    )
    ON CONFLICT (char) DO UPDATE SET
      pinyin         = EXCLUDED.pinyin,
      meaning        = EXCLUDED.meaning,
      radical        = EXCLUDED.radical,
      radical_name   = EXCLUDED.radical_name,
      hsk            = EXCLUDED.hsk,
      components     = EXCLUDED.components,
      frequency_rank = EXCLUDED.frequency_rank
  `;
  upserted++;
  if (upserted % 100 === 0) process.stdout.write(`  ${upserted}/${hskChars.length}\r`);
}

console.log(`\n✅  Upserted ${upserted} rows into chinese_characters`);

// ── 5. Summary ────────────────────────────────────────────────────────────────
const ranked = hskChars.filter((c) => data[c.char].frequencyRank != null);
const byHsk = {};
for (const c of ranked) byHsk[c.hsk] = (byHsk[c.hsk] || 0) + 1;
console.log("\nFrequency coverage by HSK:", byHsk);
console.log("Top 5 by frequency:");
ranked.sort((a, b) => data[a.char].frequencyRank - data[b.char].frequencyRank)
  .slice(0, 5)
  .forEach((c) => console.log(`  ${c.char} (HSK${c.hsk}) → rank #${data[c.char].frequencyRank}`));
