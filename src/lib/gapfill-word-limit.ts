export const WORD_LIMITS = {
  one_number: { instruction: "One word and/or a number", maxWords: 1, numberExtra: true },
  two: { instruction: "No more than two words", maxWords: 2, numberExtra: false },
  two_number: { instruction: "No more than two words and/or a number", maxWords: 2, numberExtra: true },
  three: { instruction: "No more than three words", maxWords: 3, numberExtra: false },
} as const;

export type WordLimit = keyof typeof WORD_LIMITS;

export const WORD_LIMIT_KEYS = Object.keys(WORD_LIMITS) as WordLimit[];

export const DEFAULT_WORD_LIMIT: WordLimit = "two_number";

export function isWordLimit(value: unknown): value is WordLimit {
  return WORD_LIMIT_KEYS.includes(value as WordLimit);
}

const NUMBER_TOKEN = /^[£$€]?\d[\d.,:/]*(%|st|nd|rd|th|am|pm)?$/i;

export function fitsWordLimit(answer: string, limit: WordLimit): boolean {
  const { maxWords, numberExtra } = WORD_LIMITS[limit];
  const tokens = answer.trim().split(/\s+/).filter(Boolean);
  if (!numberExtra) return tokens.length <= maxWords;
  const numbers = tokens.filter((token) => NUMBER_TOKEN.test(token)).length;
  return numbers <= 1 && tokens.length - numbers <= maxWords;
}
