"use client";

import { useTranslations } from "next-intl";
import type { EnglishSense, EnglishWord } from "@/src/declaration/english";
import { PronounceButton } from "../study/PronounceButton";
import { RelatedWordChips, WordSenseList } from "../study/WordSenseDetail";

interface FlashcardCardProps {
  word: string;
  senses: EnglishSense[];
  flipped: boolean;
  onFlip: () => void;
  audioUrl?: string;
  relatedWords?: string;
  allWords?: EnglishWord[];
  onOpenWord?: (id: number) => void;
}

export function FlashcardCard({
  word,
  senses,
  flipped,
  onFlip,
  audioUrl,
  relatedWords,
  allWords,
  onOpenWord,
}: FlashcardCardProps) {
  const t = useTranslations("English");
  const first = senses[0];

  return (
    <div
      className="w-full cursor-pointer select-none"
      style={{ perspective: "1000px", height: "clamp(16rem, 45dvh, 26rem)" }}
      onClick={onFlip}
    >
      <div
        style={{
          transformStyle: "preserve-3d",
          transition: "transform 0.5s ease",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          position: "relative",
          height: "100%",
        }}
      >
        <div className="absolute inset-0 border rounded-2xl p-8 flex flex-col items-center gap-4 shadow-sm bg-background overflow-y-auto" style={{ backfaceVisibility: "hidden" }}>
          <div className="flex items-center gap-2">
            <span className="text-4xl sm:text-5xl font-semibold text-center">{word}</span>
            <PronounceButton word={word} audioUrl={audioUrl} size="md" />
          </div>
          {first?.phonetic && <p className="text-base text-muted-foreground">/{first.phonetic}/</p>}
          {first?.partOfSpeech && (
            <span className="inline-block px-2 py-0.5 rounded bg-muted text-xs font-medium uppercase text-muted-foreground">
              {first.partOfSpeech}
            </span>
          )}
          <p className="text-xs text-muted-foreground mt-auto">{t("Common.tapToFlip")}</p>
        </div>

        <div className="absolute inset-0 border rounded-2xl p-4 sm:p-6 flex flex-col gap-3 shadow-sm bg-background overflow-y-auto" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-semibold">{word}</span>
            <PronounceButton word={word} audioUrl={audioUrl} size="md" />
          </div>
          <WordSenseList senses={senses} allWords={allWords} onOpenWord={onOpenWord} divided />
          {allWords && (
            <RelatedWordChips relatedWords={relatedWords ?? ""} allWords={allWords} onOpenWord={onOpenWord} />
          )}
        </div>
      </div>
    </div>
  );
}

export function FlashcardProgress({ index, total }: { index: number; total: number }) {
  return (
    <div className="w-full flex items-center justify-between text-sm text-muted-foreground">
      <span>{index + 1} / {total}</span>
      <div className="h-2 flex-1 mx-4 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${((index + 1) / total) * 100}%` }} />
      </div>
    </div>
  );
}
