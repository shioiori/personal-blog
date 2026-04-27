/**
 * map-from-dicts.mjs
 * Reads 4 Vietnamese dictionary sources and fills han_viet + meaning_vi
 * in all scripts/hanviet-batches/batch-XX.json files (nulls only, no overwrite).
 *
 * Priority han_viet:   hanviet-pinyin → KanjiDictVN → hanodict-hanviettra
 * Priority meaning_vi: KanjiDictVN    → CVDICT
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DICT_DIR = resolve(__dirname, 'dict-sources');
const BATCH_DIR = resolve(__dirname, 'hanviet-batches');

// ---------------------------------------------------------------------------
// 1. Parse hanviet-pinyin.csv
//    char,hanviet,pinyin
//    hanviet looks like ['thượng'] or ['phật', 'phất']
//    For multi-row chars: prefer row where pinyin='*'; otherwise take first
// ---------------------------------------------------------------------------
function parseHanvietPinyin() {
  const raw = readFileSync(resolve(DICT_DIR, 'hanviet-pinyin.csv'), 'utf8');
  const lines = raw.split(/\r?\n/);
  // Map: char -> { hv, pinyin }[]
  const tmp = new Map();
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      // Split only on first two commas to avoid issues if hanviet contains commas
      const firstComma = line.indexOf(',');
      const secondComma = line.indexOf(',', firstComma + 1);
      if (firstComma === -1 || secondComma === -1) continue;
      const char = line.slice(0, firstComma);
      const hanvietRaw = line.slice(firstComma + 1, secondComma);
      const pinyin = line.slice(secondComma + 1).trim();

      // Parse list string: ['thượng'] or ['phật', 'phất']
      const stripped = hanvietRaw.replace(/^\[/, '').replace(/\]$/, '').trim();
      // Split by comma, strip quotes, take first item
      const items = stripped.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
      const hv = items[0] || '';
      if (!hv) continue;

      if (!tmp.has(char)) tmp.set(char, []);
      tmp.get(char).push({ hv, pinyin });
    } catch (e) {
      // skip malformed
    }
  }

  // For each char: prefer pinyin='*', else take first
  const map = new Map();
  for (const [char, rows] of tmp) {
    const star = rows.find(r => r.pinyin === '*');
    map.set(char, star ? star.hv : rows[0].hv);
  }
  return map;
}

// ---------------------------------------------------------------------------
// 2. Parse kanji_bank_1.json + kanji_bank_2.json
//    entry[0] = char
//    entry[1] = "hv1 hv2 ..." -> take first token
//    entry[4] = array of strings like "[á] thứ hai" -> strip "[...] " prefix
//               take up to 3, join with "; "
// ---------------------------------------------------------------------------
function parseKanjiBanks() {
  const hvMap = new Map();
  const meaningMap = new Map();

  for (const fname of ['kanji_bank_1.json', 'kanji_bank_2.json']) {
    const raw = readFileSync(resolve(DICT_DIR, fname), 'utf8');
    const arr = JSON.parse(raw);
    for (const entry of arr) {
      try {
        const char = entry[0];
        if (!char || char.length !== 1) continue;

        // HV: take first space-separated token from entry[1]
        if (!hvMap.has(char) && entry[1] && typeof entry[1] === 'string') {
          const firstHv = entry[1].trim().split(/\s+/)[0];
          if (firstHv) hvMap.set(char, firstHv);
        }

        // Meaning: entry[4] is array of strings
        if (!meaningMap.has(char)) {
          const meanings = Array.isArray(entry[4]) ? entry[4] : [];
          if (meanings.length > 0) {
            const cleaned = meanings
              .slice(0, 3)
              .map(s => {
                // Strip leading "[...] " prefix
                return String(s).replace(/^\[[^\]]*\]\s*/, '').trim();
              })
              .filter(Boolean);
            if (cleaned.length > 0) {
              meaningMap.set(char, cleaned.join('; '));
            }
          }
        }
      } catch (e) {
        // skip malformed
      }
    }
  }
  return { hvMap, meaningMap };
}

// ---------------------------------------------------------------------------
// 3. Parse hanodict-hanviettra.csv
//    Columns: id,han,chars  (comma-separated, han may be quoted)
//    Build map: chars -> han (first occurrence)
// ---------------------------------------------------------------------------
function parseHanodict() {
  const raw = readFileSync(resolve(DICT_DIR, 'hanodict-hanviettra.csv'), 'utf8');
  const lines = raw.split(/\r?\n/);
  const map = new Map();

  // Detect separator from header
  const header = lines[0] || '';
  const sep = header.includes('\t') ? '\t' : ',';

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      let parts;
      if (sep === '\t') {
        parts = line.split('\t');
      } else {
        // CSV parse: handle quoted fields
        parts = parseCSVLine(line);
      }
      if (parts.length < 3) continue;
      // id=parts[0], han=parts[1], chars=parts[2]
      const han = parts[1].replace(/^["']|["']$/g, '').trim();
      const chars = parts[2].replace(/^["']|["']$/g, '').trim();
      if (chars && han && !map.has(chars)) {
        map.set(chars, han);
      }
    } catch (e) {
      // skip malformed
    }
  }
  return map;
}

/** Minimal CSV line parser that handles double-quoted fields */
function parseCSVLine(line) {
  const result = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      // quoted field
      i++;
      let field = '';
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          field += '"';
          i += 2;
        } else if (line[i] === '"') {
          i++;
          break;
        } else {
          field += line[i++];
        }
      }
      result.push(field);
      if (line[i] === ',') i++;
    } else {
      const end = line.indexOf(',', i);
      if (end === -1) {
        result.push(line.slice(i));
        break;
      } else {
        result.push(line.slice(i, end));
        i = end + 1;
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// 4a. Parse OpenCC STCharacters.txt -> Simplified to Traditional mapping
//     Format: simplified\ttraditional1 traditional2...
//     Take the first traditional form per char.
//     This is the authoritative simp->trad source (Apache-2.0).
// ---------------------------------------------------------------------------
function parseOpenCC() {
  const raw = readFileSync(resolve(DICT_DIR, 'STCharacters.txt'), 'utf8');
  const map = new Map();
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const tab = line.indexOf('\t');
    if (tab === -1) continue;
    const simp = line.slice(0, tab);
    const trad = line.slice(tab + 1).trim().split(' ')[0];
    if (simp.length === 1 && trad && trad.length === 1) map.set(simp, trad);
  }
  return map;
}

// ---------------------------------------------------------------------------
// 4b. Parse CVDICT.u8 (CC-CEDICT style)
//     Traditional Simplified [pinyin] /def1/def2/
//     Only single-char entries; map both trad and simp -> first 3 defs
// ---------------------------------------------------------------------------
function parseCVDict() {
  const raw = readFileSync(resolve(DICT_DIR, 'CVDICT.u8'), 'utf8');
  const lines = raw.split(/\r?\n/);
  const map = new Map();
  const re = /^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.+)\/$/;

  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;
    try {
      const m = line.match(re);
      if (!m) continue;
      const trad = m[1];
      const simp = m[2];

      // Only single-char entries for meaning map
      if (trad.length !== 1 && simp.length !== 1) continue;
      const defsStr = m[4];
      const defs = defsStr.split('/').slice(0, 3).map(s => s.trim()).filter(Boolean);
      const meaning = defs.join('; ');
      if (!meaning) continue;
      if (trad.length === 1 && !map.has(trad)) map.set(trad, meaning);
      if (simp.length === 1 && !map.has(simp)) map.set(simp, meaning);
    } catch (e) {
      // skip malformed
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// 5. Combined lookup
//    For each char, also try its Traditional form as fallback
//    (all HV dict sources use Traditional as primary key)
// ---------------------------------------------------------------------------
function makeLookup(hvPinyinMap, kanjiHvMap, hanodictHvMap, kanjiMeaningMap, cvdictMeaningMap, simpToTrad) {
  return function lookup(char) {
    const trad = simpToTrad.get(char); // undefined if char is already traditional or not in map
    const hanViet =
      hvPinyinMap.get(char) || (trad && hvPinyinMap.get(trad)) ||
      kanjiHvMap.get(char)  || (trad && kanjiHvMap.get(trad))  ||
      hanodictHvMap.get(char) || (trad && hanodictHvMap.get(trad)) ||
      null;
    const meaningVi =
      kanjiMeaningMap.get(char) || (trad && kanjiMeaningMap.get(trad)) ||
      cvdictMeaningMap.get(char) || (trad && cvdictMeaningMap.get(trad)) ||
      null;
    return { hanViet, meaningVi };
  };
}

// ---------------------------------------------------------------------------
// 6. Update batch files
// ---------------------------------------------------------------------------
function updateBatches(lookup) {
  const files = readdirSync(BATCH_DIR)
    .filter(f => f.match(/^batch-\d+\.json$/))
    .sort();

  const stats = [];
  let totalTotal = 0, totalHvFilled = 0, totalMvFilled = 0;
  let totalHvNull = 0, totalMvNull = 0;

  for (const file of files) {
    const path = resolve(BATCH_DIR, file);
    const arr = JSON.parse(readFileSync(path, 'utf8'));
    let hvFilled = 0, mvFilled = 0;
    let hvWasNull = 0, mvWasNull = 0;

    for (const entry of arr) {
      const wasHvNull = entry.han_viet === null;
      const wasMvNull = entry.meaning_vi === null;
      if (wasHvNull) hvWasNull++;
      if (wasMvNull) mvWasNull++;

      if (wasHvNull || wasMvNull) {
        const { hanViet, meaningVi } = lookup(entry.char);
        if (wasHvNull && hanViet !== null) {
          entry.han_viet = hanViet;
          hvFilled++;
        }
        if (wasMvNull && meaningVi !== null) {
          entry.meaning_vi = meaningVi;
          mvFilled++;
        }
      }
    }

    writeFileSync(path, JSON.stringify(arr, null, 2), 'utf8');

    const total = arr.length;
    // Coverage = filled / total (how many now have a value)
    const hvHaveValue = arr.filter(e => e.han_viet !== null).length;
    const mvHaveValue = arr.filter(e => e.meaning_vi !== null).length;
    stats.push({ file: file.replace('.json', ''), total, hvFilled, mvFilled, hvHaveValue, mvHaveValue });

    totalTotal += total;
    totalHvFilled += hvFilled;
    totalMvFilled += mvFilled;
    totalHvNull += hvWasNull;
    totalMvNull += mvWasNull;
  }

  return { stats, totalTotal, totalHvFilled, totalMvFilled, totalHvNull, totalMvNull };
}

// ---------------------------------------------------------------------------
// 7. Print summary table
// ---------------------------------------------------------------------------
function printSummary({ stats, totalTotal, totalHvFilled, totalMvFilled }) {
  const pad = (s, n, right = false) => {
    s = String(s);
    return right ? s.padStart(n) : s.padEnd(n);
  };

  const header =
    pad('Batch', 10) + '| ' +
    pad('Total', 7, true) + ' | ' +
    pad('HV filled', 9, true) + ' | ' +
    pad('MV filled', 9, true) + ' | ' +
    pad('HV coverage', 12, true) + ' | ' +
    pad('MV coverage', 11, true);

  const sep = '-'.repeat(header.length);

  console.log(header);
  console.log(sep);

  let sumHvHave = 0, sumMvHave = 0;
  for (const s of stats) {
    const hvPct = ((s.hvHaveValue / s.total) * 100).toFixed(1) + '%';
    const mvPct = ((s.mvHaveValue / s.total) * 100).toFixed(1) + '%';
    console.log(
      pad(s.file, 10) + '| ' +
      pad(s.total, 7, true) + ' | ' +
      pad(s.hvFilled, 9, true) + ' | ' +
      pad(s.mvFilled, 9, true) + ' | ' +
      pad(hvPct, 12, true) + ' | ' +
      pad(mvPct, 11, true)
    );
    sumHvHave += s.hvHaveValue;
    sumMvHave += s.mvHaveValue;
  }

  console.log(sep);
  const totalHvPct = ((sumHvHave / totalTotal) * 100).toFixed(1) + '%';
  const totalMvPct = ((sumMvHave / totalTotal) * 100).toFixed(1) + '%';
  console.log(
    pad('TOTAL', 10) + '| ' +
    pad(totalTotal, 7, true) + ' | ' +
    pad(totalHvFilled, 9, true) + ' | ' +
    pad(totalMvFilled, 9, true) + ' | ' +
    pad(totalHvPct, 12, true) + ' | ' +
    pad(totalMvPct, 11, true)
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
console.log('Parsing hanviet-pinyin.csv ...');
const hvPinyinMap = parseHanvietPinyin();
console.log(`  -> ${hvPinyinMap.size} chars`);

console.log('Parsing kanji_bank_1.json + kanji_bank_2.json ...');
const { hvMap: kanjiHvMap, meaningMap: kanjiMeaningMap } = parseKanjiBanks();
console.log(`  -> HV: ${kanjiHvMap.size} chars, Meaning: ${kanjiMeaningMap.size} chars`);

console.log('Parsing hanodict-hanviettra.csv ...');
const hanodictHvMap = parseHanodict();
console.log(`  -> ${hanodictHvMap.size} chars`);

console.log('Parsing OpenCC STCharacters.txt (simp->trad) ...');
const simpToTrad = parseOpenCC();
console.log(`  -> ${simpToTrad.size} simp->trad mappings`);

console.log('Parsing CVDICT.u8 ...');
const cvdictMeaningMap = parseCVDict();
console.log(`  -> ${cvdictMeaningMap.size} chars`);

const lookup = makeLookup(hvPinyinMap, kanjiHvMap, hanodictHvMap, kanjiMeaningMap, cvdictMeaningMap, simpToTrad);

console.log('\nUpdating batch files...\n');
const result = updateBatches(lookup);

printSummary(result);
console.log(`\nDone. HV filled: ${result.totalHvFilled}, MV filled: ${result.totalMvFilled}`);
