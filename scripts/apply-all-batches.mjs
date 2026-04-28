/**
 * Apply all hanviet-batches/batch-XX.json files to chinese-generated.json and DB.
 * Skips entries where han_viet is null (not filled).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const JSON_PATH = path.join(ROOT, 'src/data/chinese-generated.json');
const BATCH_DIR = path.join(__dirname, 'hanviet-batches');

// Load .env.local
const envPath = fs.existsSync(path.join(ROOT, '.env.local'))
  ? path.join(ROOT, '.env.local')
  : path.join(ROOT, '../../../.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

// Load all batch files
const batchFiles = fs.readdirSync(BATCH_DIR)
  .filter(f => f.match(/^batch-\d+\.json$/))
  .sort();

let allFilled = [];
for (const file of batchFiles) {
  const batch = JSON.parse(fs.readFileSync(path.join(BATCH_DIR, file), 'utf8'));
  const filled = batch.filter(r => r.han_viet || r.meaning_vi);
  console.log(`${file}: ${batch.length} total, ${filled.length} with data`);
  allFilled.push(...filled);
}
console.log(`\nTotal chars with data: ${allFilled.length}`);

// Apply to JSON
const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
let updated = 0;
for (const row of allFilled) {
  if (data[row.char]) {
    if (row.han_viet) data[row.char].hanViet = row.han_viet;
    if (row.meaning_vi) data[row.char].meaningVi = row.meaning_vi;
    updated++;
  }
}
fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 0), 'utf8');
console.log(`✅ JSON updated: ${updated} chars`);

// Upsert to DB
if (!process.env.DATABASE_URL) { console.log('No DATABASE_URL, skipping DB'); process.exit(0); }
const { neon } = await import('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

const DB_BATCH = 200;
let upserted = 0;
for (let i = 0; i < allFilled.length; i += DB_BATCH) {
  const chunk = allFilled.slice(i, i + DB_BATCH);
  const values = [];
  const placeholders = chunk.map((r, idx) => {
    values.push(r.char, r.han_viet ?? null, r.meaning_vi ?? null);
    return `($${idx*3+1},$${idx*3+2},$${idx*3+3})`;
  }).join(',');
  await sql.query(
    `INSERT INTO chinese_characters (char, han_viet, meaning_vi)
     VALUES ${placeholders}
     ON CONFLICT (char) DO UPDATE SET
       han_viet = COALESCE(EXCLUDED.han_viet, chinese_characters.han_viet),
       meaning_vi = COALESCE(EXCLUDED.meaning_vi, chinese_characters.meaning_vi)`,
    values
  );
  upserted += chunk.length;
  process.stdout.write(`\r  DB upsert: ${upserted}/${allFilled.length}`);
}
console.log(`\n✅ DB upserted: ${upserted} chars`);
