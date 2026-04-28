/**
 * fix-pinyin-tones.mjs
 * Converts numeric-tone pinyin (e.g. shang4, xin1, Kai3) to tone-marked pinyin
 * (e.g. shàng, xīn, Kǎi) in all batch JSON files, in both meaning and meaning_vi fields.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BATCH_DIR = path.join(__dirname, 'hanviet-batches');

const TONE_MAP = {
  a: ['ā','á','ǎ','à','a'], A: ['Ā','Á','Ǎ','À','A'],
  e: ['ē','é','ě','è','e'], E: ['Ē','É','Ě','È','E'],
  i: ['ī','í','ǐ','ì','i'], I: ['Ī','Í','Ǐ','Ì','I'],
  o: ['ō','ó','ǒ','ò','o'], O: ['Ō','Ó','Ǒ','Ò','O'],
  u: ['ū','ú','ǔ','ù','u'], U: ['Ū','Ú','Ǔ','Ù','U'],
  ü: ['ǖ','ǘ','ǚ','ǜ','ü'], Ü: ['Ǖ','Ǘ','Ǚ','Ǜ','Ü'],
};

function addToneMark(syllable, toneNum) {
  const idx = parseInt(toneNum) - 1;
  if (idx === 4) return syllable; // tone 5 = neutral, no mark
  const lower = syllable.toLowerCase();

  let pos = -1;
  // Rule 1: a or e gets the mark
  for (let i = 0; i < syllable.length; i++) {
    if ('aAeE'.includes(syllable[i])) { pos = i; break; }
  }
  // Rule 2: ou → mark the o
  if (pos === -1) {
    const oi = lower.indexOf('ou');
    if (oi !== -1) pos = oi;
  }
  // Rule 3: mark the last vowel
  if (pos === -1) {
    for (let i = syllable.length - 1; i >= 0; i--) {
      if ('aeiouüAEIOUÜ'.includes(syllable[i])) { pos = i; break; }
    }
  }
  if (pos === -1) return syllable; // no vowel, leave unchanged

  const v = syllable[pos];
  if (!TONE_MAP[v]) return syllable;
  return syllable.slice(0, pos) + TONE_MAP[v][idx] + syllable.slice(pos + 1);
}

function convertPinyin(text) {
  if (!text) return text;
  // Match: letters (including ü) followed by tone digit 1-5, not followed by another digit
  return text.replace(/([A-Za-züÜ]+)([1-5])(?!\d)/g, (match, syll, tone) => {
    // Must contain at least one vowel to be considered pinyin
    if (!/[aeiouüAEIOUÜ]/.test(syll)) return match;
    return addToneMark(syll, tone);
  });
}

// Process all batch files
const files = fs.readdirSync(BATCH_DIR)
  .filter(f => /^batch-\d+\.json$/.test(f))
  .sort();

let totalMV = 0, totalME = 0;

for (const file of files) {
  const fpath = path.join(BATCH_DIR, file);
  const batch = JSON.parse(fs.readFileSync(fpath, 'utf8'));
  let changedMV = 0, changedME = 0;

  for (const entry of batch) {
    if (entry.meaning_vi) {
      const converted = convertPinyin(entry.meaning_vi);
      if (converted !== entry.meaning_vi) { entry.meaning_vi = converted; changedMV++; }
    }
    if (entry.meaning) {
      const converted = convertPinyin(entry.meaning);
      if (converted !== entry.meaning) { entry.meaning = converted; changedME++; }
    }
  }

  fs.writeFileSync(fpath, JSON.stringify(batch, null, 2), 'utf8');
  if (changedMV || changedME) {
    console.log(`${file}: meaning_vi fixed=${changedMV}, meaning fixed=${changedME}`);
  }
  totalMV += changedMV;
  totalME += changedME;
}

console.log(`\n✅ Done. meaning_vi fixed: ${totalMV} | meaning fixed: ${totalME}`);

// Quick sanity check
console.log('\nSanity check:');
const tests = [
  ['shang4', 'shàng'], ['xin1', 'xīn'], ['e3', 'ě'],
  ['Kai3', 'Kǎi'], ['Lu3', 'Lǔ'], ['zong4', 'zòng'],
  ['dang4', 'dàng'], ['mou2', 'móu'], ['ni2', 'ní'],
];
for (const [input, expected] of tests) {
  const result = convertPinyin(input);
  const ok = result === expected ? '✅' : '❌';
  console.log(`  ${ok} ${input} → ${result} (expected: ${expected})`);
}
