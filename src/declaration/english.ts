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

export interface PokemonSpecies {
  id: number;
  name: string;
}

export interface GachaChainProgress {
  stage: number;
  currentId: number | null;
  dup: number;
}

export interface GachaCollectionEntry {
  chainKey: string;
  chain: PokemonSpecies[][];
  progress: GachaChainProgress;
}

export type GachaPullResult =
  | { type: "new"; species: PokemonSpecies; chainKey: string }
  | { type: "dup"; species: PokemonSpecies; chainKey: string; progress: number; needed: number }
  | { type: "evolve"; species: PokemonSpecies; chainKey: string }
  | { type: "choose_evolution"; options: PokemonSpecies[]; chainKey: string }
  | { type: "maxed"; species: PokemonSpecies; chainKey: string };

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
