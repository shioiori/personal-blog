"use client";

import type { EnglishWord } from "@/src/declaration/english";

interface WordTooltipProps {
  word: EnglishWord;
}

export function WordTooltip({ word }: WordTooltipProps) {
  return (
    <div className="max-w-xs space-y-2 p-1">
      <p className="font-semibold">{word.word}</p>
      {word.senses.map((s, i) => (
        <div key={i} className="text-xs space-y-0.5 border-t border-border/50 pt-1 first:border-0 first:pt-0">
          {s.partOfSpeech && <span className="text-muted-foreground uppercase font-medium">{s.partOfSpeech}</span>}
          {s.meaningVi && <p>{s.meaningVi}</p>}
          {s.cambridgeMeaning && <p className="text-muted-foreground italic">{s.cambridgeMeaning}</p>}
          {s.example && <p className="text-muted-foreground">&quot;{s.example}&quot;</p>}
        </div>
      ))}
    </div>
  );
}
