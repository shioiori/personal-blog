"use client";

import type { MouseEvent } from "react";
import { useCallback, useState } from "react";
import { Bookmark, BookmarkCheck, Star, Volume2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/src/components/ui/Tooltip";
import { TooltipMode } from "@/src/components/enums";
import { useSpeech } from "@/src/hooks/useSpeech";
import { useLearnedChars } from "@/src/context/chinese";
import type { CharTooltipProps } from "@/src/declaration/chinese";

const crawlDataCache = new Map<string, unknown>();

function getPayload(data: unknown) {
  if (data && typeof data === "object" && "payload" in data) {
    return (data as { payload?: unknown }).payload;
  }
  return data;
}

function collectThiVienLines(data: unknown): string[] {
  if (data && typeof data === "object" && "dictionary" in data) {
    const dictionary = (data as {
      dictionary?: {
        pinyin?: string;
        hanviet?: string;
        meanings?: string[];
      };
    }).dictionary;
    const lines = [
      dictionary?.pinyin ? `Pinyin: ${dictionary.pinyin}` : "",
      dictionary?.hanviet ? `Hán Việt: ${dictionary.hanviet}` : "",
      ...(dictionary?.meanings ?? []),
    ].filter(Boolean);
    if (lines.length > 0) return lines.slice(0, 7);
  }

  const payload = getPayload(data);
  if (!payload || typeof payload !== "object") return [];

  const result = (payload as { result?: unknown }).result;
  if (!Array.isArray(result)) return [];

  return result
    .flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const output = (entry as { o?: unknown }).o;
      if (Array.isArray(output)) {
        return output
          .map((item) => {
            if (Array.isArray(item)) return item.filter(Boolean).join(" ");
            return typeof item === "string" ? item : "";
          })
          .filter(Boolean);
      }
      return typeof output === "string" ? [output] : [];
    })
    .filter((line, index, lines) => line && lines.indexOf(line) === index)
    .slice(0, 4);
}

export function CharTooltip({ char, info, edits, mode }: CharTooltipProps) {
  const { speak } = useSpeech();
  const { learnedChars, toggleLearned } = useLearnedChars();
  const [crawlData, setCrawlData] = useState<unknown>(() => edits.crawlData);
  const [crawlLoading, setCrawlLoading] = useState(false);
  const [crawlError, setCrawlError] = useState(false);
  const displayPinyin = edits.pinyin || info.pinyin;
  const displayHanViet = edits.hanViet || info.hanViet;
  const displayMeaning = edits.meaningVi || info.meaningVi || info.meaning;
  const learned = learnedChars.has(info.char);
  const thiVienLines = collectThiVienLines(crawlData);

  const handleToggleLearned = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    toggleLearned(info.char);
  };

  const loadCrawlData = useCallback(async () => {
    if (crawlData !== undefined || crawlLoading) return;

    if (crawlDataCache.has(info.char)) {
      setCrawlData(crawlDataCache.get(info.char));
      return;
    }

    setCrawlLoading(true);
    setCrawlError(false);
    try {
      const res = await fetch(`/api/chinese/crawl-data?char=${encodeURIComponent(info.char)}`);
      if (!res.ok) throw new Error("crawl failed");
      const data = (await res.json()) as { crawlData?: unknown };
      crawlDataCache.set(info.char, data.crawlData);
      setCrawlData(data.crawlData);
    } catch {
      setCrawlError(true);
    } finally {
      setCrawlLoading(false);
    }
  }, [crawlData, crawlLoading, info.char]);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip onOpenChange={(open) => open && void loadCrawlData()}>
        <TooltipTrigger asChild>
          <span
            className="cursor-default hover:text-primary transition-colors"
            style={{ fontFamily: "var(--font-noto-serif-sc), serif" }}
          >
            {char}
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          sideOffset={6}
          avoidCollisions
          collisionPadding={12}
          className="max-h-[min(70vh,420px)] w-[min(92vw,360px)] overflow-hidden text-xs space-y-1.5 p-3"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold" style={{ fontFamily: "var(--font-noto-serif-sc), serif" }}>{info.char}</span>
            {mode !== TooltipMode.NoPinyin && <span className="tracking-wider">{displayPinyin}</span>}
            <button
              onClick={handleToggleLearned}
              className="ml-auto text-muted-foreground/60 hover:text-primary transition-colors"
              title={learned ? "Đã học - click để bỏ đánh dấu" : "Chưa học - click để đánh dấu đã học"}
            >
              {learned ? (
                <BookmarkCheck className="h-3.5 w-3.5 fill-current" />
              ) : (
                <Bookmark className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                speak(info.char);
              }}
              className="text-muted-foreground/50 hover:text-primary transition-colors"
              title="Phát âm"
            >
              <Volume2 className="h-3.5 w-3.5" />
            </button>
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
          <div className="max-h-56 overflow-y-auto overscroll-contain border-t border-background/20 pt-1.5 pr-1 space-y-1.5">
            <p className="text-[10px] uppercase tracking-wide opacity-60">Thi Viện</p>
            {crawlLoading && <p className="opacity-70">Đang tải...</p>}
            {crawlError && <p className="opacity-70">Không lấy được dữ liệu.</p>}
            {!crawlLoading && !crawlError && thiVienLines.length === 0 && (
              <p className="opacity-70">Chưa có dữ liệu.</p>
            )}
            {thiVienLines.length > 0 && (
              <div className="space-y-1">
                {thiVienLines.map((line) => (
                  <p key={line} className="whitespace-pre-wrap opacity-90">
                    {line}
                  </p>
                ))}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
