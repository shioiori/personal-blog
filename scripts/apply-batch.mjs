/**
 * Apply Hán Việt data from a completed batch file to chinese-generated.json and DB.
 * Usage: node scripts/apply-batch.mjs <batchFile.json>
 *
 * The batch file should be JSON array of { char, han_viet, meaning_vi, ... }
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const JSON_PATH = path.join(ROOT, 'src/data/chinese-generated.json');

// Load env
const envPath = fs.existsSync(path.join(ROOT, '.env.local'))
  ? path.join(ROOT, '.env.local')
  : path.join(ROOT, '../../../.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

const batchFile = process.argv[2];
if (!batchFile) { console.error('Usage: node apply-batch.mjs <batchFile>'); process.exit(1); }

const batch = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
const filled = batch.filter(r => r.han_viet);
console.log(`Batch: ${batch.length} chars | Filled: ${filled.length} | Missing: ${batch.length - filled.length}`);

if (filled.length === 0) { console.log('Nothing to apply.'); process.exit(0); }

// Apply to JSON
const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
let updated = 0;
for (const row of filled) {
  if (data[row.char]) {
    data[row.char].hanViet = row.han_viet;
    data[row.char].meaningVi = row.meaning_vi;
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
for (let i = 0; i < filled.length; i += DB_BATCH) {
  const chunk = filled.slice(i, i + DB_BATCH);
  const values = [];
  const placeholders = chunk.map((r, idx) => {
    values.push(r.char, r.han_viet ?? null, r.meaning_vi ?? null);
    return `($${idx*3+1},$${idx*3+2},$${idx*3+3})`;
  }).join(',');
  await sql.query(
    `INSERT INTO chinese_characters (char, han_viet, meaning_vi)
     VALUES ${placeholders}
     ON CONFLICT (char) DO UPDATE SET han_viet=EXCLUDED.han_viet, meaning_vi=EXCLUDED.meaning_vi`,
    values
  );
  upserted += chunk.length;
}
console.log(`✅ DB upserted: ${upserted} chars`);
