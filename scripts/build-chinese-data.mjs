/**
 * Build chinese-generated.json from CC-CEDICT + complete-hsk-vocabulary.
 * Run: node scripts/build-chinese-data.mjs
 *
 * Strategy:
 * - CC-CEDICT: provides single-char entries with pinyin + English meaning (~13k chars)
 * - complete-hsk-vocabulary: provides radical + HSK level for single chars
 * - Merge: CEDICT as base, HSK data overlays radical + hsk fields
 * - Filter: keep chars that have a radical (from HSK data) OR are in HSK 1-6
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(__dirname, "../src/data/raw");
const OUT = path.join(__dirname, "../src/data/chinese-generated.json");

// --- Parse CC-CEDICT ---
console.log("Parsing CC-CEDICT...");
const cedictLines = fs
  .readFileSync(path.join(RAW, "cedict.txt"), "utf8")
  .split("\n")
  .filter((l) => !l.startsWith("#") && l.trim());

// Map: simplified char -> { pinyin, meanings[] }
// CEDICT format: Traditional Simplified [pinyin] /meaning1/meaning2/
const cedictMap = new Map();
for (const line of cedictLines) {
  const match = line.match(/^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.+)\/\s*$/);
  if (!match) continue;
  const [, , simp, pinyin, meaningsRaw] = match;
  if ([...simp].length !== 1) continue; // single char only
  const code = simp.codePointAt(0);
  if (code < 0x4e00) continue; // CJK range only

  const meanings = meaningsRaw
    .split("/")
    .map((m) => m.trim())
    .filter(Boolean);

  // Keep first entry per char (most common reading), skip "variant of" entries
  if (!cedictMap.has(simp)) {
    cedictMap.set(simp, { pinyin, meanings });
  }
}
console.log(`CEDICT: ${cedictMap.size} unique single CJK chars`);

// --- Parse HSK vocabulary (for radical + HSK level) ---
console.log("Parsing HSK vocabulary...");
const hskRaw = JSON.parse(
  fs.readFileSync(path.join(RAW, "hsk-complete.json"), "utf8")
);

// Map: char -> { radical, hsk }
// HSK levels: old-1..old-6 → 1..6
const hskMap = new Map();
for (const entry of hskRaw) {
  const simp = entry.simplified;
  if (!simp || [...simp].length !== 1) continue;
  const code = simp.codePointAt(0);
  if (code < 0x4e00) continue;

  // Find lowest old-N level
  const levels = (entry.level || [])
    .filter((l) => /^old-[1-6]$/.test(l))
    .map((l) => parseInt(l.split("-")[1]));
  const hsk = levels.length > 0 ? Math.min(...levels) : null;

  hskMap.set(simp, {
    radical: entry.radical || null,
    hsk,
  });
}
console.log(`HSK map: ${hskMap.size} single chars`);

// --- Build radical name map ---
// We'll use a small hardcoded map for the 214 Kangxi radicals (common ones)
// The radical character itself is sufficient for display; radicalName is for Vietnamese
// We'll leave radicalName = radical for now (user can annotate later)

// --- Merge ---
console.log("Merging...");
const result = {};
let skippedNoRadical = 0;

for (const [char, cedict] of cedictMap) {
  const hskData = hskMap.get(char);
  const radical = hskData?.radical || null;
  const hskLevel = hskData?.hsk || "beyond";

  // Skip chars with no radical info AND not in HSK 1-6
  if (!radical) {
    skippedNoRadical++;
    continue;
  }

  // Clean up pinyin: remove tone marks normalization not needed, keep as-is
  const pinyin = cedict.pinyin;

  // Meaning: join first 2 meanings, skip "variant of" entries as primary
  const filteredMeanings = cedict.meanings.filter(
    (m) => !m.startsWith("variant of") && !m.startsWith("old variant")
  );
  const meaning =
    filteredMeanings.length > 0
      ? filteredMeanings.slice(0, 2).join("; ")
      : cedict.meanings.slice(0, 1).join("");

  result[char] = {
    char,
    pinyin,
    meaning,
    radical,
    radicalName: radical, // placeholder; same as radical char for now
    hsk: hskLevel,
  };
}

// Also add HSK chars that might not be in CEDICT
for (const [char, hskData] of hskMap) {
  if (result[char] || !hskData.radical) continue;
  // Not in CEDICT, but in HSK — add with empty meaning
  result[char] = {
    char,
    pinyin: "",
    meaning: "",
    radical: hskData.radical,
    radicalName: hskData.radical,
    hsk: hskData.hsk || "beyond",
  };
}

const total = Object.keys(result).length;
console.log(`Output: ${total} characters`);
console.log(`Skipped (no radical): ${skippedNoRadical}`);

// Stats by HSK
const byHsk = {};
for (const c of Object.values(result)) {
  byHsk[c.hsk] = (byHsk[c.hsk] || 0) + 1;
}
console.log("By HSK:", byHsk);

// Stats by radical
const radicalCounts = {};
for (const c of Object.values(result)) {
  radicalCounts[c.radical] = (radicalCounts[c.radical] || 0) + 1;
}
const topRadicals = Object.entries(radicalCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);
console.log("Top 10 radicals:", topRadicals);

fs.writeFileSync(OUT, JSON.stringify(result, null, 0), "utf8");
console.log(`Written to ${OUT} (${Math.round(fs.statSync(OUT).size / 1024)}KB)`);
