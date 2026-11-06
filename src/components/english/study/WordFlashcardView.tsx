"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/src/components/ui/Button";
import type { EnglishWord } from "@/src/declaration/english";
import { getCrawlAudioUrl } from "./crawlData";
import { FlashcardCard, FlashcardProgress } from "../shared/FlashcardCard";

interface WordFlashcardViewProps {
  words: EnglishWord[];
}

export function WordFlashcardView({ words }: WordFlashcardViewProps) {
  const t = useTranslations("English");
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    setIndex(0);
    setFlipped(false);
  }, [words]);

  function goNext() {
    setFlipped(false);
    setIndex((i) => Math.min(i + 1, words.length - 1));
  }

  function goPrev() {
    setFlipped(false);
    setIndex((i) => Math.max(i - 1, 0));
  }

  useEffect(() => {
    if (words.length === 0) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable], [role=listbox], [role=dialog]")) return;
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "Enter") setFlipped((f) => !f);
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (words.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
        <p className="text-lg font-medium">{t("Words.noWords")}</p>
      </div>
    );
  }

  const safeIndex = Math.min(index, words.length - 1);
  const current = words[safeIndex];

  return (
    <div className="flex flex-col items-center gap-6 max-w-2xl mx-auto py-8 px-4">
      <FlashcardProgress index={safeIndex} total={words.length} />

      <FlashcardCard
        word={current.word}
        senses={current.senses}
        flipped={flipped}
        onFlip={() => setFlipped((f) => !f)}
        audioUrl={getCrawlAudioUrl(current)}
        relatedWords={current.relatedWords}
        allWords={words}
      />

      <div className="grid grid-cols-2 gap-2 w-full">
        <Button onClick={goPrev} variant="outline" disabled={safeIndex === 0}>{t("Words.prev")}</Button>
        <Button onClick={goNext} disabled={safeIndex >= words.length - 1}>{t("Words.next")}</Button>
      </div>
    </div>
  );
}
