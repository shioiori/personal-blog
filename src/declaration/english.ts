export interface EnglishSense {
  id?: number;
  phonetic?: string;
  partOfSpeech?: string;
  cambridgeMeaning?: string;
  meaningVi?: string;
  example?: string;
  synonyms?: string;
  antonyms?: string;
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
}

export interface EnglishGroup {
  id: number;
  name: string;
  wordIds: number[];
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
