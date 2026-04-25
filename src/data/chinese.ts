import rawData from "./chinese-generated.json";

export type HskLevel = 1 | 2 | 3 | 4 | 5 | 6 | "beyond";

export interface CharacterInfo {
  char: string;
  pinyin: string;
  meaning: string;
  radical: string;
  radicalName: string;
  hsk: HskLevel;
  components: string[];
  frequencyRank?: number | null;
  hanViet?: string | null;
  meaningVi?: string | null;
}

export const CHINESE_DATA = rawData as Record<string, CharacterInfo>;

export function getAllCharacters(): CharacterInfo[] {
  return Object.values(CHINESE_DATA);
}
