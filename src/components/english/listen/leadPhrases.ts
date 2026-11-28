import type { ReadPart } from "./listenSettings";

// Spoken lead-ins ("The English meaning is…"). Kept here rather than in the
// message files because the reading language can differ from the site language,
// and only the site language's messages are loaded.

export type LeadLang = "vi" | "en";

const PART_LEADS: Record<LeadLang, Partial<Record<ReadPart, string>>> = {
  vi: {
    spelling: "Đánh vần",
    partOfSpeech: "Loại từ của từ này là",
    meaningEn: "Nghĩa tiếng Anh là",
    meaningVi: "Nghĩa tiếng Việt là",
    example: "Ví dụ",
    synonyms: "Từ đồng nghĩa",
    antonyms: "Từ trái nghĩa",
    note: "Ghi chú",
  },
  en: {
    spelling: "Spelling",
    partOfSpeech: "The part of speech is",
    meaningEn: "The English meaning is",
    meaningVi: "The Vietnamese meaning is",
    example: "For example",
    synonyms: "Synonyms",
    antonyms: "Antonyms",
    note: "Note",
  },
};

const VI_ORDINALS = ["nhất", "hai", "ba", "tư", "năm", "sáu", "bảy", "tám", "chín", "mười"];
const EN_ORDINALS = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth"];

/** "Nghĩa thứ nhất" / "First meaning" for sense n (1-based). */
function senseHeading(lang: LeadLang, n: number): string {
  if (lang === "vi") return `Nghĩa thứ ${VI_ORDINALS[n - 1] ?? n}`;
  return EN_ORDINALS[n - 1] ? `${EN_ORDINALS[n - 1]} meaning` : `Meaning ${n}`;
}

export interface LeadIns {
  /** Speech language for the lead-ins, e.g. "vi-VN". */
  lang: string;
  part: (part: ReadPart) => string | undefined;
  senseHeading: (n: number) => string;
}

export function leadIns(lang: LeadLang): LeadIns {
  return {
    lang: lang === "vi" ? "vi-VN" : "en-US",
    part: (p) => PART_LEADS[lang][p],
    senseHeading: (n) => senseHeading(lang, n),
  };
}
