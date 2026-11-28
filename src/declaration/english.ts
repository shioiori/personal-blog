import type { WordLimit } from "@/src/lib/gapfill-word-limit";

export interface EnglishSense {
  id?: number;
  phonetic?: string;
  partOfSpeech?: string;
  cambridgeMeaning?: string;
  meaningVi?: string;
  example?: string;
  synonyms?: string;
  antonyms?: string;
  note?: string;
  images?: string[];
  sortOrder?: number;
}

export interface EnglishWord {
  id: number;
  word: string;
  createdAt: string;
  senses: EnglishSense[];
  groupIds: number[];
  flashcardActive: boolean;
  crawlData?: unknown;
  /** Comma-separated related words (e.g. "obese, obesity"), resolved by text to other words in the list. */
  relatedWords?: string;
  altSpelling?: string;
  /** URL of the page the word was captured from (e.g. via the browser extension). */
  sourceUrl?: string;
  summary?: boolean;
}

export interface EnglishGroup {
  id: number;
  name: string;
  wordIds: number[];
  /** Set when this group was auto-created for a page's source URL (see EnglishWord.sourceUrl) — such a group can't be left manually: it always contains every word whose sourceUrl matches. */
  sourceUrl?: string;
}

export interface FlashcardCard {
  wordId: number;
  word: string;
  senses: EnglishSense[];
}

export interface WritingCard {
  wordId: number;
  word: string;
  meaningVi: string;
  example: string;
}

export type WritingGrade = 0 | 1 | 2 | 3;

export interface WritingCheckResult {
  usedWord: boolean;
  correctWord: boolean;
  correctContext: boolean;
  grade: 0 | 1 | 2 | 3;
  feedback: string;
}

export interface ImportSenseInput {
  phonetic?: string;
  partOfSpeech?: string;
  cambridgeMeaning?: string;
  meaningVi?: string;
  example?: string;
  synonyms?: string;
  antonyms?: string;
  note?: string;
}

export interface ImportWordInput {
  word: string;
  senses: ImportSenseInput[];
}

export interface GapFillAnswer {
  answer: string;
  alternatives: string[];
}

export interface GapFillAttempt {
  id: number;
  responses: string[];
  results: boolean[];
  score: number;
  total: number;
}

export interface GapFillExerciseSummary {
  id: number;
  title: string;
  wordLimit: WordLimit;
  createdAt: string;
  blankCount: number;
  attemptCount: number;
  bestScore: number | null;
}

export interface GapFillScriptSummary {
  id: number;
  name: string | null;
  source: string | null;
  preview: string;
  createdAt: string;
  exerciseCount: number;
}

export interface GapFillScript {
  id: number;
  name: string | null;
  source: string | null;
  transcript: string;
  exercises: GapFillExerciseSummary[];
}

export interface GapFillExercise {
  id: number;
  scriptId: number;
  title: string;
  source: string | null;
  content: string;
  wordLimit: WordLimit;
  blankCount: number;
  answers: GapFillAnswer[] | null;
  attempts: GapFillAttempt[];
}

import type { EssayCategory } from "@/src/lib/essay-categories";

// ── Essay (IELTS Writing Task 2 style) ──────────────────────────────────────

export interface EssayDraft {
  id: number;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface Essay {
  id: number;
  title: string;
  /** IELTS Task 2 topic ids from ESSAY_CATEGORIES; empty = not categorized. */
  categories: EssayCategory[];
  drafts: EssayDraft[];
  done: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EssaySummary {
  id: number;
  title: string;
  categories: EssayCategory[];
  done: boolean;
  createdAt: string;
  updatedAt: string;
}

export type EssayCategoryGroups = Partial<Record<EssayCategory, number[]>>;

export interface EssaySpellIssue {
  original: string;
  suggestion: string;
  type: "spelling" | "grammar";
  explanation: string;
}

export interface LookupResult {
  result: string;
  explanation?: string;
}
