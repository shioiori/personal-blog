import type { EnglishWord } from "@/src/declaration/english";

export interface CambridgeCrawlData {
  fetchedAt?: string;
  url?: string;
  pronunciations?: { region?: string; ipa?: string; audioUrl?: string }[];
  senses?: { partOfSpeech?: string; definitions: { text: string; examples: string[] }[] }[];
  synonyms?: string[];
  antonyms?: string[];
  raw?: string;
}

export function getCrawlData(word: EnglishWord): CambridgeCrawlData | undefined {
  return word.crawlData as CambridgeCrawlData | undefined;
}

export function getCrawlAudioUrl(word: EnglishWord): string | undefined {
  const dict = getCrawlData(word);
  return dict?.pronunciations?.find((p) => p.audioUrl)?.audioUrl;
}

export function getCrawlIpa(word: EnglishWord): string | undefined {
  const dict = getCrawlData(word);
  return dict?.pronunciations?.find((p) => p.ipa)?.ipa;
}
