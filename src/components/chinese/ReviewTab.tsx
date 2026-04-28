"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { cn } from "@/src/utils/ui";
import { ReviewStatus } from "@/src/components/enums";

const STORAGE_KEY = "chinese_review_text";

type ReviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "no_words" }
  | { status: "too_few"; learnedCount: number; minWords: number }
  | { status: "ready"; text: string; learnedCount: number }
  | { status: "rate_limited"; used: number; limit: number }
  | { status: "error" };

export function ReviewTab() {
  const [state, setState] = useState<ReviewState>({ status: "idle" });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { text: string; learnedCount: number };
        setState({ status: "ready", text: parsed.text, learnedCount: parsed.learnedCount });
      }
    } catch {
      // ignore
    }
  }, []);

  const generate = useCallback(async () => {
    setState({ status: "loading" });
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

      if (data.error === "rate_limited") {
        setState({ status: "rate_limited", used: data.used ?? 100, limit: data.limit ?? 100 });
      } else if (data.error === "no_words") {
        setState({ status: "no_words" });
      } else if (data.error === "too_few") {
        setState({ status: "too_few", learnedCount: data.learnedCount ?? 0, minWords: data.minWords ?? 5 });
      } else if (data.text) {
        const next = { text: data.text, learnedCount: data.learnedCount ?? 0 };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setState({ status: "ready", ...next });
      } else {
        setState({ status: "error" });
      }
    } catch {
      setState({ status: "error" });
    }
  }, []);

  const HIDE_GENERATE_BTN: ReviewStatus[] = [ReviewStatus.Loading, ReviewStatus.NoWords, ReviewStatus.TooFew, ReviewStatus.RateLimited];
  const showGenerateBtn = !HIDE_GENERATE_BTN.includes(state.status as ReviewStatus);

  return (
    <div className="flex flex-col items-center gap-6 py-8 px-4 max-w-2xl mx-auto">
      <div className="w-full">
        {state.status === "idle" && (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <p className="text-sm">Nhấn Generate để tạo đoạn văn ôn tập từ các từ đã học.</p>
          </div>
        )}

        {state.status === "loading" && (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <RefreshCw className="w-6 h-6 animate-spin" />
            <p className="text-sm">Đang tạo đoạn văn ôn tập...</p>
          </div>
        )}

        {state.status === "no_words" && (
          <div className="text-center py-16 space-y-2">
            <p className="text-lg font-medium">Chưa có từ nào được đánh dấu là đã học.</p>
            <p className="text-sm text-muted-foreground">
              Quay lại tab học và tích vào các từ bạn đã biết để bắt đầu ôn tập.
            </p>
          </div>
        )}

        {state.status === "too_few" && (
          <div className="text-center py-16 space-y-2">
            <p className="text-lg font-medium">Chưa đủ từ để tạo câu.</p>
            <p className="text-sm text-muted-foreground">
              Bạn mới học được <span className="font-semibold text-foreground">{state.learnedCount}</span> từ.
              Cần ít nhất <span className="font-semibold text-foreground">{state.minWords}</span> từ để tạo đoạn văn ôn tập.
            </p>
          </div>
        )}

        {state.status === "rate_limited" && (
          <div className="text-center py-16 space-y-2">
            <p className="text-lg font-medium">Đã đạt giới hạn hôm nay.</p>
            <p className="text-sm text-muted-foreground">
              Đã sử dụng <span className="font-semibold text-foreground">{state.used}</span>/
              <span className="font-semibold text-foreground">{state.limit}</span> lần generate trong ngày.
              Quay lại vào ngày mai nhé!
            </p>
          </div>
        )}

        {state.status === "error" && (
          <div className="text-center py-16 space-y-2">
            <p className="text-lg font-medium text-destructive">Có lỗi xảy ra.</p>
            <p className="text-sm text-muted-foreground">Vui lòng thử lại.</p>
          </div>
        )}

        {state.status === "ready" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <p
                className="text-2xl leading-relaxed text-center"
                style={{ fontFamily: "var(--font-noto-serif-sc), serif" }}
              >
                {state.text}
              </p>
            </div>
            <p className="text-xs text-center text-muted-foreground">
              Tạo từ {state.learnedCount} từ đã học
            </p>
          </div>
        )}
      </div>

      {showGenerateBtn && (
        <button
          onClick={() => void generate()}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium",
            "bg-background hover:bg-accent transition-colors"
          )}
        >
          {state.status === "ready" ? (
            <RefreshCw className="w-4 h-4" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {state.status === "ready" ? "Tạo lại" : "Generate"}
        </button>
      )}
    </div>
  );
}
