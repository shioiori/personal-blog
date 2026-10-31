"use client";

import { useState, useEffect } from "react";
import { Button } from "@/src/components/ui/Button";
import type { EnglishWord } from "@/src/declaration/english";
import { PronounceButton } from "./PronounceButton";

interface WordFlashcardViewProps {
  words: EnglishWord[];
}

export function WordFlashcardView({ words }: WordFlashcardViewProps) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    setIndex(0);
    setFlipped(false);
  }, [words]);

  if (words.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
        <p className="text-lg font-medium">Không có từ nào</p>
      </div>
    );
  }

  const safeIndex = Math.min(index, words.length - 1);
  const current = words[safeIndex];
  const first = current.senses[0];

  function goNext() {
    setFlipped(false);
    setIndex((i) => Math.min(i + 1, words.length - 1));
  }

  function goPrev() {
    setFlipped(false);
    setIndex((i) => Math.max(i - 1, 0));
  }

  return (
    <div className="flex flex-col items-center gap-6 max-w-md mx-auto py-8">
      <div className="w-full flex items-center justify-between text-sm text-muted-foreground">
        <span>{safeIndex + 1} / {words.length}</span>
        <div className="h-2 flex-1 mx-4 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${(safeIndex / words.length) * 100}%` }} />
        </div>
      </div>

      <div
        className="w-full cursor-pointer select-none"
        style={{ perspective: "1000px", minHeight: "16rem" }}
        onClick={() => setFlipped((f) => !f)}
      >
        <div
          style={{
            transformStyle: "preserve-3d",
            transition: "transform 0.5s ease",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
            position: "relative",
            minHeight: "16rem",
          }}
        >
          <div className="absolute inset-0 border rounded-2xl p-8 flex flex-col items-center justify-center gap-4 shadow-sm bg-background" style={{ backfaceVisibility: "hidden" }}>
            <div className="flex items-center gap-2">
              <span className="text-4xl font-semibold text-center">{current.word}</span>
              <PronounceButton word={current.word} size="md" />
            </div>
            {first?.phonetic && <p className="text-base text-muted-foreground">/{first.phonetic}/</p>}
            {first?.partOfSpeech && (
              <span className="inline-block px-2 py-0.5 rounded bg-muted text-xs font-medium uppercase text-muted-foreground">
                {first.partOfSpeech}
              </span>
            )}
            <p className="text-xs text-muted-foreground mt-auto">Nhấn để lật thẻ</p>
          </div>

          <div className="absolute inset-0 border rounded-2xl p-8 flex flex-col items-center gap-3 shadow-sm bg-background overflow-y-auto" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
            <span className="text-2xl font-semibold text-center">{current.word}</span>
            {current.senses.map((s, i) => (
              <div key={i} className="w-full text-center text-sm space-y-1 border-t border-border/50 pt-2 first:border-0 first:pt-0">
                {s.partOfSpeech && <span className="text-xs text-muted-foreground uppercase font-medium">{s.partOfSpeech}</span>}
                {s.meaningVi && <p className="font-medium">{s.meaningVi}</p>}
                {s.cambridgeMeaning && <p className="text-muted-foreground italic">{s.cambridgeMeaning}</p>}
                {s.example && <p className="text-xs text-muted-foreground">&quot;{s.example}&quot;</p>}
                {(s.synonyms || s.antonyms) && (
                  <p className="text-xs text-muted-foreground">
                    {s.synonyms && <>Đồng nghĩa: {s.synonyms} </>}
                    {s.antonyms && <>Trái nghĩa: {s.antonyms}</>}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 w-full">
        <Button onClick={goPrev} variant="outline" disabled={safeIndex === 0}>Trước</Button>
        <Button onClick={goNext} disabled={safeIndex >= words.length - 1}>Tiếp theo</Button>
      </div>
    </div>
  );
}
