"use client";

import { Pencil, Trash2 } from "lucide-react";
import type { EnglishWord } from "@/src/declaration/english";

interface WordCardProps {
  word: EnglishWord;
  onEdit: () => void;
  onDelete: () => void;
}

export function WordCard({ word, onEdit, onDelete }: WordCardProps) {
  const first = word.senses[0];
  return (
    <div className="rounded-lg border border-border bg-card p-3 flex flex-col gap-1 group">
      <div className="flex items-start justify-between gap-1">
        <div>
          <span className="text-base font-semibold">{word.word}</span>
          {first?.phonetic && <span className="ml-2 text-xs text-muted-foreground">/{first.phonetic}/</span>}
        </div>
        <div className="hidden group-hover:flex items-center gap-1 shrink-0">
          <button onClick={onEdit} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {word.senses.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {[...new Set(word.senses.map((s) => s.partOfSpeech).filter(Boolean))].map((pos) => (
            <span key={pos} className="inline-block px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium uppercase text-muted-foreground">
              {pos}
            </span>
          ))}
        </div>
      )}
      {first?.meaningVi && <div className="text-xs text-foreground/80 line-clamp-2">{first.meaningVi}</div>}
      {!first?.meaningVi && first?.cambridgeMeaning && (
        <div className="text-xs text-foreground/70 line-clamp-2">{first.cambridgeMeaning}</div>
      )}
      {word.senses.length > 1 && (
        <span className="text-[10px] text-muted-foreground/70">+{word.senses.length - 1} nghĩa khác</span>
      )}
    </div>
  );
}
