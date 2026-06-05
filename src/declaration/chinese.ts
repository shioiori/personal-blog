import type { CharacterInfo } from "@/src/data/chinese";
import type { TooltipMode, ReviewStatus } from "@/src/components/enums";

export interface CompoundCategory {
  id: number;
  name: string;
}

export interface CompoundWord {
  id: number;
  word: string;
  meaning: string;
  pinyin: string;
  hanViet: string;
  note: string;
  categoryIds: number[];
}

export interface UserEdits {
  pinyin?: string;
  hanViet?: string;
  meaningVi?: string;
  note?: string;
  crawlData?: unknown;
}

export type ReviewState =
  | { status: ReviewStatus.Idle }
  | { status: ReviewStatus.Loading }
  | { status: ReviewStatus.NoWords }
  | { status: ReviewStatus.TooFew; learnedCount: number; minWords: number }
  | { status: ReviewStatus.Ready; text: string; learnedCount: number }
  | { status: ReviewStatus.RateLimited; used: number; limit: number }
  | { status: ReviewStatus.Error };

export interface ReviewTabProps {
  allChars: CharacterInfo[];
  userEdits: Record<string, UserEdits>;
  hiddenCards: Set<string>;
}

export interface CharTooltipProps {
  char: string;
  info: CharacterInfo;
  edits: UserEdits;
  mode: TooltipMode;
}

export interface ReviewTextProps {
  text: string;
  charMap: Map<string, CharacterInfo>;
  userEdits: Record<string, UserEdits>;
  mode: TooltipMode;
}
