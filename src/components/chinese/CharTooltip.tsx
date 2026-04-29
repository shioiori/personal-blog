"use client";

import { Star } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/src/components/ui/Tooltip";
import { TooltipMode } from "@/src/components/enums";
import type { CharTooltipProps } from "@/src/declaration/chinese";

export function CharTooltip({ char, info, edits, mode }: CharTooltipProps) {
  const displayPinyin = edits.pinyin || info.pinyin;
  const displayHanViet = edits.hanViet || info.hanViet;
  const displayMeaning = edits.meaningVi || info.meaningVi || info.meaning;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="cursor-default hover:text-primary transition-colors"
            style={{ fontFamily: "var(--font-noto-serif-sc), serif" }}
          >
            {char}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[240px] text-xs space-y-1.5 p-3">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold" style={{ fontFamily: "var(--font-noto-serif-sc), serif" }}>{info.char}</span>
            {mode !== TooltipMode.NoPinyin && <span className="tracking-wider">{displayPinyin}</span>}
          </div>
          {info.hsk !== "beyond" && (
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: info.hsk as number }, (_, i) => (
                  <Star key={i} className="h-2.5 w-2.5" style={{ color: ["","#9ca3af","#e2e8f0","#22c55e","#22d3ee","#3b82f6","#a855f7","#facc15","#f97316","#ef4444"][info.hsk as number], fill: "currentColor", stroke: "none" }} />
                ))}
              </div>
              <span>HSK {info.hsk}</span>
            </div>
          )}
          {mode !== TooltipMode.NoMeaning && <p>{displayMeaning}</p>}
          {mode !== TooltipMode.NoMeaning && (displayHanViet || edits.note) && (
            <div className="opacity-80 space-y-1.5">
              {displayHanViet && <p>{displayPinyin} · {displayHanViet}</p>}
              {edits.note && <p className="whitespace-pre-wrap">{edits.note}</p>}
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
