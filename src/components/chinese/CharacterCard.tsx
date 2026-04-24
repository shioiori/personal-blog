"use client";

import { cn } from "@/src/utils/ui";
import { Badge } from "@/src/components/ui/Badge";
import type { CharacterInfo } from "@/src/data/chinese";

interface CharacterCardProps {
  info: CharacterInfo;
  hidden: boolean;
  onToggleHide: (char: string) => void;
}

export function CharacterCard({ info, hidden, onToggleHide }: CharacterCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onToggleHide(info.char)}
      onKeyDown={(e) => e.key === "Enter" && onToggleHide(info.char)}
      className={cn(
        "rounded-2xl border border-border bg-card p-3 cursor-pointer select-none",
        "transition-all duration-200 hover:border-primary/50 active:scale-[0.97]",
        "flex flex-col items-center gap-1.5 min-h-[120px] justify-center"
      )}
    >
      <div
        className="text-5xl font-bold leading-none"
        style={{ fontFamily: "var(--font-noto-serif-sc), 'SimSun', 'STSong', serif" }}
      >
        {info.char}
      </div>

      <div
        className={cn(
          "flex flex-col items-center gap-0.5 transition-all duration-300 w-full",
          hidden ? "opacity-30 blur-[3px] pointer-events-none" : "opacity-100 blur-none"
        )}
      >
        <p className="text-xs font-medium text-muted-foreground tracking-wider">
          {info.pinyin}
        </p>
        <p className="text-xs text-center text-foreground line-clamp-2 px-1">
          {info.meaning}
        </p>
      </div>

      <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 mt-0.5">
        {info.hsk === "beyond" ? "Ngoài HSK" : `HSK ${info.hsk}`}
      </Badge>
    </div>
  );
}
