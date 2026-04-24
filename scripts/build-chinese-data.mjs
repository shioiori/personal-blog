/**
 * Build chinese-generated.json from all sources.
 * Run: node scripts/build-chinese-data.mjs
 *
 * Sources (merged, union):
 *   1. CC-CEDICT  — pinyin + English meaning (~10k single CJK chars)
 *   2. Make Me a Hanzi — radical + decomposition + definition (~9.5k chars)
 *   3. complete-hsk-vocabulary — HSK level + radical (for HSK chars)
 *
 * Rule: include ANY char that has a CJK code point. No other requirements.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(__dirname, "../src/data/raw");
const OUT = path.join(__dirname, "../src/data/chinese-generated.json");

// ── Pinyin numeric → diacritics ──────────────────────────────────────────────
const TONE_MAP = {
  a:["ā","á","ǎ","à","a"], e:["ē","é","ě","è","e"], i:["ī","í","ǐ","ì","i"],
  o:["ō","ó","ǒ","ò","o"], u:["ū","ú","ǔ","ù","u"], ü:["ǖ","ǘ","ǚ","ǜ","ü"],
};
function addTone(s, tone) {
  s = s.replace(/v/g, "ü");
  if (tone === 5 || tone === 0) return s;
  const t = tone - 1;
  if (s.includes("a")) return s.replace("a", TONE_MAP["a"][t]);
  if (s.includes("e")) return s.replace("e", TONE_MAP["e"][t]);
  if (s.includes("ou")) return s.replace("o", TONE_MAP["o"][t]);
  const vowelPattern = /[aeiouü]/g;
  let lastIdx = -1, lastVowel = "", m;
  while ((m = vowelPattern.exec(s)) !== null) { lastIdx = m.index; lastVowel = m[0]; }
  if (lastIdx !== -1) return s.slice(0, lastIdx) + (TONE_MAP[lastVowel]?.[t] ?? lastVowel) + s.slice(lastIdx + 1);
  return s;
}
function numericToTone(pinyin) {
  // Normalise u: → ü before splitting
  const norm = pinyin.trim().replace(/u:/gi, "ü");
  // Split on spaces OR between digit and letter (e.g. "shi2ke4" → "shi2 ke4")
  const syllables = norm.replace(/([1-5])([a-züA-ZÜ])/g, "$1 $2").split(/\s+/);
  return syllables.map(syl => {
    const m = syl.match(/^([a-züA-ZÜ]+)([1-5])?$/i);
    if (!m) return syl;
    const [, base, tn] = m;
    return addTone(base.toLowerCase(), tn ? parseInt(tn) : 5);
  }).join(" ");
}

function isCJK(ch) {
  const cp = ch.codePointAt(0);
  return (cp >= 0x4E00 && cp <= 0x9FFF)   // CJK Unified Ideographs
      || (cp >= 0x3400 && cp <= 0x4DBF)   // CJK Extension A
      || (cp >= 0x20000 && cp <= 0x2A6DF) // CJK Extension B
      || (cp >= 0xF900 && cp <= 0xFAFF)   // CJK Compatibility
      || (cp >= 0x2E80 && cp <= 0x2EFF);  // CJK Radicals Supplement
}

// ── 1. Parse CC-CEDICT ────────────────────────────────────────────────────────
console.log("Parsing CC-CEDICT...");
const cedictLines = fs.readFileSync(path.join(RAW, "cedict.txt"), "utf8")
  .split("\n").filter(l => !l.startsWith("#") && l.trim());

const cedictMap = new Map(); // char → { pinyin, meaning }
for (const line of cedictLines) {
  const match = line.match(/^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.+)\/\s*$/);
  if (!match) continue;
  const [, , simp, pinyinRaw, meaningsRaw] = match;
  if ([...simp].length !== 1 || !isCJK(simp)) continue;
  if (cedictMap.has(simp)) continue; // keep first (most common) entry

  const meanings = meaningsRaw.split("/").map(m => m.trim()).filter(Boolean);
  const filtered = meanings.filter(m => !m.startsWith("variant of") && !m.startsWith("old variant"));
  const meaning = (filtered.length > 0 ? filtered : meanings).slice(0, 2).join("; ");

  cedictMap.set(simp, { pinyin: numericToTone(pinyinRaw), meaning });
}
console.log(`CEDICT: ${cedictMap.size} single CJK chars`);

// ── 2. Parse Make Me a Hanzi ─────────────────────────────────────────────────
console.log("Parsing Make Me a Hanzi...");
const IDS_OPS = new Set([..."⿰⿱⿲⿳⿴⿵⿶⿷⿸⿹⿺⿻"]);

function extractComponents(decomp) {
  if (!decomp) return [];
  const out = [];
  for (const ch of decomp) {
    if (!IDS_OPS.has(ch) && ch !== "？" && isCJK(ch)) out.push(ch);
  }
  return [...new Set(out)];
}

const mmahByChar = new Map(); // char → mmah entry
for (const line of fs.readFileSync(path.join(RAW, "makemeahanzi.txt"), "utf8").split("\n").filter(Boolean)) {
  try {
    const e = JSON.parse(line);
    if (e.character && isCJK(e.character)) mmahByChar.set(e.character, e);
  } catch {}
}
console.log(`Make Me a Hanzi: ${mmahByChar.size} chars`);

// ── 3. Parse HSK vocabulary ───────────────────────────────────────────────────
console.log("Parsing HSK vocabulary...");
const hskMap = new Map(); // char → { radical, hsk }
for (const entry of JSON.parse(fs.readFileSync(path.join(RAW, "hsk-complete.json"), "utf8"))) {
  const simp = entry.simplified;
  if (!simp || [...simp].length !== 1 || !isCJK(simp)) continue;
  const levels = (entry.level || [])
    .filter(l => /^old-[1-6]$/.test(l))
    .map(l => parseInt(l.split("-")[1]));
  hskMap.set(simp, {
    radical: entry.radical || null,
    hsk: levels.length > 0 ? Math.min(...levels) : null,
  });
}
console.log(`HSK map: ${hskMap.size} chars`);

// ── 4. Union all chars ────────────────────────────────────────────────────────
console.log("Building union...");
const allChars = new Set([...cedictMap.keys(), ...mmahByChar.keys()]);
console.log(`Union: ${allChars.size} unique chars`);

// ── 5. Merge into result ──────────────────────────────────────────────────────
const result = {};

for (const char of allChars) {
  const cedict = cedictMap.get(char);
  const mmah = mmahByChar.get(char);
  const hsk = hskMap.get(char);

  // Radical: HSK first (most accurate for simplified), then MMAH
  const radical = hsk?.radical || mmah?.radical || "";

  // HSK level
  const hskLevel = hsk?.hsk ?? "beyond";

  // Pinyin: CEDICT first (has tones), MMAH fallback
  const pinyin = cedict?.pinyin || (mmah?.pinyin?.[0] ?? "");

  // Meaning: CEDICT (English, cleaned), MMAH definition fallback
  const meaning = cedict?.meaning || mmah?.definition || "";

  result[char] = {
    char,
    pinyin,
    meaning,
    radical,
    radicalName: radical,
    hsk: hskLevel,
    components: [], // filled next
  };
}

// ── 6. Fill components ────────────────────────────────────────────────────────
let withComponents = 0;
for (const [char, entry] of Object.entries(result)) {
  const mmah = mmahByChar.get(char);
  const comps = mmah
    ? extractComponents(mmah.decomposition).filter(c => c !== char && result[c])
    : [];
  entry.components = comps;
  if (comps.length > 0) withComponents++;
}

// ── 7. Stats ──────────────────────────────────────────────────────────────────
const total = Object.keys(result).length;
const byHsk = {};
for (const c of Object.values(result)) byHsk[c.hsk] = (byHsk[c.hsk] || 0) + 1;
const noRadical = Object.values(result).filter(c => !c.radical).length;

console.log(`Total: ${total} characters`);
console.log(`No radical: ${noRadical}`);
console.log(`With components: ${withComponents}`);
console.log("By HSK:", byHsk);

// ── 8. Write ──────────────────────────────────────────────────────────────────
fs.writeFileSync(OUT, JSON.stringify(result, null, 0), "utf8");
console.log(`Written to ${OUT} (${Math.round(fs.statSync(OUT).size / 1024)}KB)`);
