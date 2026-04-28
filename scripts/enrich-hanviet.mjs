/**
 * Enrich chinese-generated.json with Hán Việt pronunciation + Vietnamese meaning.
 * Uses Claude Haiku with prompt caching. Processes all 12,933 chars.
 *
 * Progress is saved to src/data/hanviet-progress.json after each batch
 * so the script can be safely interrupted and resumed.
 *
 * Run: node scripts/enrich-hanviet.mjs
 * Requires: ANTHROPIC_API_KEY and DATABASE_URL in .env.local
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const JSON_PATH = path.join(ROOT, "src/data/chinese-generated.json");
const PROGRESS_PATH = path.join(ROOT, "src/data/hanviet-progress.json");

// ── Load .env.local ───────────────────────────────────────────────────────────
const envPath = fs.existsSync(path.join(ROOT, ".env.local"))
  ? path.join(ROOT, ".env.local")
  : path.join(ROOT, "../../../.env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

if (!process.env.ANTHROPIC_API_KEY) { console.error("❌  ANTHROPIC_API_KEY not set"); process.exit(1); }
if (!process.env.DATABASE_URL) { console.error("❌  DATABASE_URL not set"); process.exit(1); }

const client = new Anthropic();
const BATCH = 50;
const MAX_RETRIES = 3;

const SYSTEM_PROMPT = `Bạn là chuyên gia Hán Nôm và tiếng Trung. Nhiệm vụ: với mỗi chữ Hán được cung cấp, trả về:
- hanViet: âm Hán Việt của chữ (phiên âm Sino-Vietnamese). Nếu không biết, trả về null.
- meaningVi: nghĩa tiếng Việt ngắn gọn (1-4 từ). Nếu không biết, trả về null.

Trả về JSON array hợp lệ, không giải thích gì thêm. Ví dụ:
[{"char":"的","hanViet":"đích","meaningVi":"của (sở hữu)"},{"char":"一","hanViet":"nhất","meaningVi":"một"}]`;

// ── Load data ─────────────────────────────────────────────────────────────────
const data = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
const allChars = Object.values(data);

// Load progress (resume support)
const progress = fs.existsSync(PROGRESS_PATH)
  ? JSON.parse(fs.readFileSync(PROGRESS_PATH, "utf8"))
  : {};
const alreadyDone = Object.keys(progress).length;
console.log(`Total chars: ${allChars.length} | Already done: ${alreadyDone}`);

// Only process chars not yet in progress
const todo = allChars.filter((c) => !(c.char in progress));
console.log(`Remaining: ${todo.length} | Batches: ${Math.ceil(todo.length / BATCH)}`);
if (todo.length === 0) { console.log("Nothing to do."); process.exit(0); }

// ── Claude API call with retry ────────────────────────────────────────────────
async function enrichBatch(chars) {
  const lines = chars.map((c) => `${c.char} (${c.pinyin}) - ${c.meaning}`).join("\n");
  const userMsg = `Chữ cần xử lý:\n${lines}\n\nTrả về JSON array với đúng ${chars.length} phần tử, theo thứ tự trên.`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const msg = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: userMsg }],
      });

      const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
      // Extract JSON array from response
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) throw new Error("No JSON array in response");
      const parsed = JSON.parse(match[0]);
      if (!Array.isArray(parsed)) throw new Error("Not an array");
      return parsed;
    } catch (e) {
      if (attempt === MAX_RETRIES) throw e;
      const wait = 2000 * attempt;
      console.warn(`  Retry ${attempt}/${MAX_RETRIES} after ${wait}ms: ${e.message}`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

// ── Process batches ───────────────────────────────────────────────────────────
let done = 0;
let errors = 0;
const startTime = Date.now();

for (let i = 0; i < todo.length; i += BATCH) {
  const batch = todo.slice(i, i + BATCH);
  const batchNum = Math.floor(i / BATCH) + 1;
  const totalBatches = Math.ceil(todo.length / BATCH);

  try {
    const results = await enrichBatch(batch);

    for (let j = 0; j < batch.length; j++) {
      const char = batch[j].char;
      const result = results[j] ?? {};
      progress[char] = {
        hanViet: result.hanViet ?? null,
        meaningVi: result.meaningVi ?? null,
      };
    }

    fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 0), "utf8");
    done += batch.length;

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const pct = ((alreadyDone + done) / allChars.length * 100).toFixed(1);
    process.stdout.write(`  Batch ${batchNum}/${totalBatches} | ${pct}% | ${elapsed}s\r`);
  } catch (e) {
    errors++;
    console.error(`\n  ❌ Batch ${batchNum} failed: ${e.message}`);
    // Mark as null so we know it failed
    for (const c of batch) {
      if (!(c.char in progress)) progress[c.char] = { hanViet: null, meaningVi: null };
    }
    fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 0), "utf8");
  }
}

console.log(`\n✅  Enrichment done. Errors: ${errors}`);

// ── Merge progress into JSON ──────────────────────────────────────────────────
console.log("Merging into chinese-generated.json...");
let hanVietCount = 0, meaningViCount = 0;
for (const [char, result] of Object.entries(progress)) {
  if (!data[char]) continue;
  data[char].hanViet = result.hanViet ?? null;
  data[char].meaningVi = result.meaningVi ?? null;
  if (result.hanViet) hanVietCount++;
  if (result.meaningVi) meaningViCount++;
}
fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 0), "utf8");
console.log(`✅  JSON updated | hanViet: ${hanVietCount} | meaningVi: ${meaningViCount}`);

// ── Update DB ─────────────────────────────────────────────────────────────────
console.log("\nUpdating DB...");
const { neon } = await import("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);

await sql`ALTER TABLE chinese_characters ADD COLUMN IF NOT EXISTS han_viet TEXT`;
await sql`ALTER TABLE chinese_characters ADD COLUMN IF NOT EXISTS meaning_vi TEXT`;
console.log("Columns ensured");

// Batch upsert only chars that have data
const toUpsert = Object.values(data).filter((c) => c.hanViet || c.meaningVi);
console.log(`Upserting ${toUpsert.length} rows...`);

const DB_BATCH = 200;
let upserted = 0;
for (let i = 0; i < toUpsert.length; i += DB_BATCH) {
  const batch = toUpsert.slice(i, i + DB_BATCH);
  const values = [];
  const placeholders = batch.map((c, idx) => {
    const base = idx * 3;
    values.push(c.char, c.hanViet ?? null, c.meaningVi ?? null);
    return `($${base+1},$${base+2},$${base+3})`;
  }).join(",");

  await sql.query(
    `INSERT INTO chinese_characters (char, han_viet, meaning_vi)
     VALUES ${placeholders}
     ON CONFLICT (char) DO UPDATE SET
       han_viet   = EXCLUDED.han_viet,
       meaning_vi = EXCLUDED.meaning_vi`,
    values,
  );
  upserted += batch.length;
  process.stdout.write(`  ${upserted}/${toUpsert.length}\r`);
}
console.log(`\n✅  DB updated`);
