"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Sparkles, Copy } from "lucide-react";
import { cn } from "@/src/utils/ui";
import { TooltipMode, ReviewStatus } from "@/src/components/enums";
import { buildReviewPrompt } from "@/src/utils/chinese";
import { CharTooltip } from "./CharTooltip";
import type { ReviewState, ReviewTabProps, ReviewTextProps } from "@/src/declaration/chinese";
import { CHINESE_REVIEW_TEXT } from "@/src/constants";

function isChinese(ch: string) {
  const code = ch.codePointAt(0) ?? 0;
  return (code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf);
}


function ReviewText({ text, charMap, userEdits, mode }: ReviewTextProps) {
  const chars = Array.from(text);
  return (
    <p
      className="text-2xl leading-relaxed text-center"
      style={{ fontFamily: "var(--font-noto-serif-sc), serif" }}
    >
      {chars.map((ch, i) => {
        const info = isChinese(ch) ? charMap.get(ch) : undefined;
        if (info && mode !== TooltipMode.Off) {
          return (
            <CharTooltip
              key={i}
              char={ch}
              info={info}
              edits={userEdits[ch] ?? {}}
              mode={mode}
            />
          );
        }
        return <span key={i}>{ch}</span>;
      })}
    </p>
  );
}

export function ReviewTab({ allChars, userEdits, hiddenCards }: ReviewTabProps) {
  const [state, setState] = useState<ReviewState>({ status: ReviewStatus.Idle });
  const [tooltipMode, setTooltipMode] = useState<TooltipMode>(TooltipMode.Full);
  const [copiedChars, setCopiedChars] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const charMap = new Map(allChars.map((c) => [c.char, c]));
  const learnedList = allChars.filter((c) => hiddenCards.has(c.char)).map((c) => c.char).join("\n");

  function handleCopyChars() {
    navigator.clipboard.writeText(learnedList).then(() => {
      setCopiedChars(true);
      setTimeout(() => setCopiedChars(false), 1500);
    });
  }

  function handleCopyPrompt() {
    navigator.clipboard.writeText(buildReviewPrompt(learnedList)).then(() => {
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 1500);
    });
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CHINESE_REVIEW_TEXT);
      if (saved) {
        const parsed = JSON.parse(saved) as { text: string; learnedCount: number };
        setState({ status: ReviewStatus.Ready, text: parsed.text, learnedCount: parsed.learnedCount });
      }
    } catch {
      // ignore
    }
  }, []);

  const generate = useCallback(async () => {
    setState({ status: ReviewStatus.Loading });
    try {
      const res = await fetch("/api/chinese/review");
      const data = await res.json() as {
        error?: string;
        text?: string;
        learnedCount?: number;
        minWords?: number;
        used?: number;
        limit?: number;
      };

      if (data.error === ReviewStatus.RateLimited) {
        setState({ status: ReviewStatus.RateLimited, used: data.used ?? 100, limit: data.limit ?? 100 });
      } else if (data.error === ReviewStatus.NoWords) {
        setState({ status: ReviewStatus.NoWords });
      } else if (data.error === ReviewStatus.TooFew) {
        setState({ status: ReviewStatus.TooFew, learnedCount: data.learnedCount ?? 0, minWords: data.minWords ?? 5 });
      } else if (data.text) {
        const next = { text: data.text, learnedCount: data.learnedCount ?? 0 };
        localStorage.setItem(CHINESE_REVIEW_TEXT, JSON.stringify(next));
        setState({ status: ReviewStatus.Ready, ...next });
      } else {
        setState({ status: ReviewStatus.Error });
      }
    } catch {
      setState({ status: ReviewStatus.Error });
    }
  }, []);

  const modeOptions: { value: TooltipMode; label: string }[] = [
    { value: TooltipMode.Full, label: "Hiện đầy đủ" },
    { value: TooltipMode.NoPinyin, label: "Ẩn pinyin" },
    { value: TooltipMode.NoMeaning, label: "Ẩn nghĩa" },
    { value: TooltipMode.Off, label: "Không hiện" },
  ];

  return (
    <div className="flex flex-col items-start gap-6 py-8">
      <div className="flex items-center gap-4 flex-wrap w-full">
        {modeOptions.map((opt) => (
          <label key={opt.value} className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="radio"
              name="tooltip-mode"
              value={opt.value}
              checked={tooltipMode === opt.value}
              onChange={() => setTooltipMode(opt.value)}
              className="accent-primary"
            />
            {opt.label}
          </label>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleCopyChars}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border text-xs text-muted-foreground hover:bg-accent transition-colors"
          >
            <Copy className="w-3 h-3" />
            {copiedChars ? "Đã copy!" : "Copy từ đã học"}
          </button>
          <button
            onClick={handleCopyPrompt}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border text-xs text-muted-foreground hover:bg-accent transition-colors"
          >
            <Copy className="w-3 h-3" />
            {copiedPrompt ? "Đã copy!" : "Copy prompt"}
          </button>
        </div>
      </div>
      <div className="w-full max-w-2xl mx-auto">
        {state.status === ReviewStatus.Idle && (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <p className="text-sm">Nhấn Generate để tạo đoạn văn ôn tập từ các từ đã học.</p>
          </div>
        )}

        {state.status === ReviewStatus.Loading && (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <RefreshCw className="w-6 h-6 animate-spin" />
            <p className="text-sm">Đang tạo đoạn văn ôn tập...</p>
          </div>
        )}

        {state.status === ReviewStatus.NoWords && (
          <div className="text-center py-16 space-y-2">
            <p className="text-lg font-medium">Chưa có từ nào được đánh dấu là đã học.</p>
            <p className="text-sm text-muted-foreground">
              Quay lại tab học và tích vào các từ bạn đã biết để bắt đầu ôn tập.
            </p>
          </div>
        )}

        {state.status === ReviewStatus.TooFew && (
          <div className="text-center py-16 space-y-2">
            <p className="text-lg font-medium">Chưa đủ từ để tạo câu.</p>
            <p className="text-sm text-muted-foreground">
              Bạn mới học được <span className="font-semibold text-foreground">{state.learnedCount}</span> từ.
              Cần ít nhất <span className="font-semibold text-foreground">{state.minWords}</span> từ để tạo đoạn văn ôn tập.
            </p>
          </div>
        )}

        {state.status === ReviewStatus.RateLimited && (
          <div className="text-center py-16 space-y-2">
            <p className="text-lg font-medium">Đã đạt giới hạn hôm nay.</p>
            <p className="text-sm text-muted-foreground">
              Đã sử dụng <span className="font-semibold text-foreground">{state.used}</span>/
              <span className="font-semibold text-foreground">{state.limit}</span> lần generate trong ngày.
              Quay lại vào ngày mai nhé!
            </p>
          </div>
        )}

        {state.status === ReviewStatus.Error && (
          <div className="text-center py-16 space-y-2">
            <p className="text-lg font-medium text-destructive">Có lỗi xảy ra.</p>
            <p className="text-sm text-muted-foreground">Vui lòng thử lại.</p>
          </div>
        )}

        {state.status === ReviewStatus.Ready && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <ReviewText
                text={state.text}
                charMap={charMap}
                userEdits={userEdits}
                mode={tooltipMode}
              />
            </div>
            <p className="text-xs text-center text-muted-foreground">
              Tạo từ {state.learnedCount} từ đã học
            </p>
          </div>
        )}

        {state.status !== ReviewStatus.Loading && (
          <div className="flex justify-center pt-2">
            <button
              onClick={() => void generate()}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium",
                "bg-background hover:bg-accent transition-colors"
              )}
            >
              {state.status === ReviewStatus.Ready ? (
                <><RefreshCw className="w-4 h-4" />Tạo lại</>
              ) : (
                <><Sparkles className="w-4 h-4" />Generate</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
