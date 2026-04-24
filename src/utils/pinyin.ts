// Convert numeric-tone pinyin to diacritic pinyin.
// e.g. "ni3 hao3" → "nǐ hǎo", "zuo4" → "zuò"
// Rules follow standard pinyin tone-mark placement:
//   1. If there's an 'a' or 'e', it takes the mark.
//   2. If there's 'ou', 'o' takes the mark.
//   3. Otherwise the last vowel (a e i o u ü) takes the mark.

const TONE_MAP: Record<string, string[]> = {
  a: ["ā", "á", "ǎ", "à", "a"],
  e: ["ē", "é", "ě", "è", "e"],
  i: ["ī", "í", "ǐ", "ì", "i"],
  o: ["ō", "ó", "ǒ", "ò", "o"],
  u: ["ū", "ú", "ǔ", "ù", "u"],
  ü: ["ǖ", "ǘ", "ǚ", "ǜ", "ü"],
};

// v is sometimes used for ü in numeric pinyin
const NORMALIZE: Record<string, string> = { v: "ü" };

function addTone(syllable: string, tone: number): string {
  // Normalize v → ü
  let s = syllable.replace(/v/g, "ü");

  if (tone === 5 || tone === 0) return s; // neutral tone

  const t = tone - 1; // 0-indexed

  // Rule 1: a or e gets the mark
  if (s.includes("a")) return s.replace("a", TONE_MAP["a"][t]);
  if (s.includes("e")) return s.replace("e", TONE_MAP["e"][t]);

  // Rule 2: ou → o gets the mark
  if (s.includes("ou")) return s.replace("o", TONE_MAP["o"][t]);

  // Special cases: ui → i, iu → u (last vowel in cluster takes mark)
  if (s.includes("ui")) return s.replace(/i(?=[^aeiouü]|$)/, TONE_MAP["i"][t]);
  if (s.includes("iu")) return s.replace(/u(?=[^aeiouü]|$)/, TONE_MAP["u"][t]);

  // Rule 3: last vowel gets the mark
  const vowelPattern = /[aeiouü]/g;
  let lastIdx = -1;
  let lastVowel = "";
  let m;
  while ((m = vowelPattern.exec(s)) !== null) {
    lastIdx = m.index;
    lastVowel = m[0];
  }
  if (lastIdx !== -1) {
    return s.slice(0, lastIdx) + TONE_MAP[lastVowel]?.[t] + s.slice(lastIdx + 1);
  }

  return s;
}

export function numericToTone(pinyin: string): string {
  // Handle multi-syllable: "ni3 hao3"
  return pinyin
    .trim()
    .split(/\s+/)
    .map((syllable) => {
      const match = syllable.match(/^([a-züA-ZÜ]+)([1-5])?$/);
      if (!match) return syllable;
      const [, base, toneNum] = match;
      const tone = toneNum ? parseInt(toneNum) : 5;
      return addTone(base.toLowerCase(), tone);
    })
    .join(" ");
}
