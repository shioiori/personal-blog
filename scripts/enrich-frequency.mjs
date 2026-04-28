/**
 * Enrich chinese-generated.json with frequency ranks from hanziDB.csv (Jun Da's list).
 * Processes ALL characters (HSK 1–6 + beyond).
 *
 * Also:
 *   - Adds frequency_rank column to chinese_characters table (if missing)
 *   - Upserts all chars that have a frequency rank (batched 200/query)
 *
 * Run: node scripts/enrich-frequency.mjs
 * Requires: DATABASE_URL in .env.local
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const RAW = path.join(ROOT, "src/data/raw");
const JSON_PATH = path.join(ROOT, "src/data/chinese-generated.json");

// ── Load .env.local (worktree root first, then parent project root) ───────────
const envPath = fs.existsSync(path.join(ROOT, ".env.local"))
  ? path.join(ROOT, ".env.local")
  : path.join(ROOT, "../../../.env.local");
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
const freqMap = new Map();

for (const line of csvLines.slice(1)) {
  if (!line.trim()) continue;
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
console.log(`Total chars: ${allChars.length}`);

// ── 3. Enrich ALL chars with frequencyRank ────────────────────────────────────
let enriched = 0;
for (const c of allChars) {
  const rank = freqMap.get(c.char);
  data[c.char].frequencyRank = rank ?? null;
  if (rank != null) enriched++;
}
const byHsk = {};
for (const c of allChars) {
  if (data[c.char].frequencyRank != null) {
    byHsk[c.hsk] = (byHsk[c.hsk] || 0) + 1;
  }
}
console.log(`Enriched with rank: ${enriched} / ${allChars.length}`);
console.log("Coverage by HSK:", byHsk);

fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 0), "utf8");
console.log(`✅  chinese-generated.json updated`);

// ── 4. Update DB ──────────────────────────────────────────────────────────────
console.log("\nConnecting to Neon DB...");
const { neon } = await import("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);

await sql`
  CREATE TABLE IF NOT EXISTS chinese_characters (
    char           TEXT PRIMARY KEY,
    pinyin         TEXT NOT NULL DEFAULT '',
    meaning        TEXT NOT NULL DEFAULT '',
    radical        TEXT NOT NULL DEFAULT '',
    radical_name   TEXT NOT NULL DEFAULT '',
    hsk            TEXT NOT NULL DEFAULT 'beyond',
    components     TEXT[] NOT NULL DEFAULT '{}',
    frequency_rank INTEGER,
    seeded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;
await sql`ALTER TABLE chinese_characters ADD COLUMN IF NOT EXISTS frequency_rank INTEGER`;
console.log("Schema ready");

// Only upsert chars that have a frequency rank (avoids upserting all 13k rows)
const toUpsert = allChars.filter((c) => data[c.char].frequencyRank != null);
console.log(`Upserting ${toUpsert.length} chars with frequency data...`);

const BATCH = 200;
let done = 0;
for (let i = 0; i < toUpsert.length; i += BATCH) {
  const batch = toUpsert.slice(i, i + BATCH);

  // Build parameterized multi-row VALUES
  const values = [];
  const placeholders = batch.map((c, idx) => {
    const entry = data[c.char];
    const base = idx * 8;
    values.push(
      entry.char,
      entry.pinyin,
      entry.meaning,
      entry.radical,
      entry.radicalName,
      String(entry.hsk),
      entry.components,        // text[]
      entry.frequencyRank,     // integer
    );
    return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7}::text[],$${base+8})`;
  }).join(",");

  await sql.query(
    `INSERT INTO chinese_characters (char,pinyin,meaning,radical,radical_name,hsk,components,frequency_rank)
     VALUES ${placeholders}
     ON CONFLICT (char) DO UPDATE SET
       pinyin         = EXCLUDED.pinyin,
       meaning        = EXCLUDED.meaning,
       radical        = EXCLUDED.radical,
       radical_name   = EXCLUDED.radical_name,
       hsk            = EXCLUDED.hsk,
       components     = EXCLUDED.components,
       frequency_rank = EXCLUDED.frequency_rank`,
    values,
  );

  done += batch.length;
  process.stdout.write(`  ${done}/${toUpsert.length}\r`);
}

console.log(`\n✅  Upserted ${done} rows into chinese_characters`);

// ── 5. Summary ────────────────────────────────────────────────────────────────
console.log("\nTop 5 most frequent chars:");
toUpsert
  .sort((a, b) => data[a.char].frequencyRank - data[b.char].frequencyRank)
  .slice(0, 5)
  .forEach((c) => console.log(`  ${c.char} (HSK ${c.hsk}) → rank #${data[c.char].frequencyRank}`));
