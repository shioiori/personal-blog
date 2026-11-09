"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Volume2 } from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import type { EnglishWord } from "@/src/declaration/english";
import { getCrawlAudioUrl } from "./crawlData";
import { FlashcardCard, FlashcardProgress } from "../shared/FlashcardCard";
import { usePronounce } from "./PronounceButton";
import { cn } from "@/src/utils/ui";

interface WordFlashcardViewProps {
  words: EnglishWord[];
}

const AUTO_PRONOUNCE_KEY = "english-study-flashcard-auto-pronounce";

export function WordFlashcardView({ words }: WordFlashcardViewProps) {
  const t = useTranslations("English");
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [autoPronounce, setAutoPronounce] = useState(false);
  const { pronounce } = usePronounce();

  useEffect(() => {
    try {
      setAutoPronounce(localStorage.getItem(AUTO_PRONOUNCE_KEY) === "1");
    } catch {
      // ignore
    }
  }, []);

  function toggleAutoPronounce() {
    setAutoPronounce((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(AUTO_PRONOUNCE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

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
      else if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "Enter") handleFlip();
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
  const audioUrl = getCrawlAudioUrl(current);

  useEffect(() => {
    if (autoPronounce) pronounce(current.word, audioUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.id]);

  useEffect(() => {
    if (flipped && autoPronounce) pronounce(current.word, audioUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipped]);

  function handleFlip() {
    setFlipped((f) => !f);
  }

  return (
    <div className="flex flex-col items-center gap-6 max-w-2xl mx-auto py-8 px-4">
      <div className="w-full flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <FlashcardProgress index={safeIndex} total={words.length} />
        </div>
        <button
          type="button"
          onClick={toggleAutoPronounce}
          title={t("Words.autoPronounceOnFlip")}
          className={cn(
            "shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs transition-colors",
            autoPronounce ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t("Words.autoPronounceOnFlip")}</span>
        </button>
      </div>

      <FlashcardCard
        word={current.word}
        senses={current.senses}
        flipped={flipped}
        onFlip={handleFlip}
        audioUrl={audioUrl}
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
