/**
 * One-off cleanup: strip leading/trailing "/" from english_senses.phonetic
 * (old data saved with slashes still baked in, e.g. "/ˈænjuəɫ/").
 * Run: node --env-file=.env.local scripts/fix-phonetic-slashes.mjs
 *
 * Safe to re-run.
 */

import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL not set. Run with: node --env-file=.env.local scripts/fix-phonetic-slashes.mjs");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

const rows = await sql`
  UPDATE english_senses
  SET phonetic = trim(both '/' from phonetic)
  WHERE phonetic LIKE '/%' OR phonetic LIKE '%/'
  RETURNING id, phonetic
`;

console.log(`Updated ${rows.length} row(s).`);
for (const r of rows) console.log(`  #${r.id} -> "${r.phonetic}"`);
