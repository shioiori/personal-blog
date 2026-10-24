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
