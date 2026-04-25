"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/src/utils/ui";

type ReviewState =
  | { status: "loading" }
  | { status: "no_words" }
  | { status: "too_few"; learnedCount: number; minWords: number }
  | { status: "ready"; text: string; learnedCount: number }
  | { status: "error" };

export function ReviewTab() {
  const [state, setState] = useState<ReviewState>({ status: "loading" });

  const generate = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/chinese/review");
      const data = await res.json() as {
        error?: string;
        text?: string;
        learnedCount?: number;
        minWords?: number;
      };

      if (data.error === "no_words") {
        setState({ status: "no_words" });
      } else if (data.error === "too_few") {
        setState({ status: "too_few", learnedCount: data.learnedCount ?? 0, minWords: data.minWords ?? 5 });
      } else if (data.text) {
        setState({ status: "ready", text: data.text, learnedCount: data.learnedCount ?? 0 });
      } else {
        setState({ status: "error" });
      }
    } catch {
      setState({ status: "error" });
    }
  }, []);

  useEffect(() => {
    void generate();
  }, [generate]);

  return (
    <div className="flex flex-col items-center gap-6 py-8 px-4 max-w-2xl mx-auto">
      <div className="w-full">
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

      {(state.status === "ready" || state.status === "error") && (
        <button
          onClick={() => void generate()}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium",
            "bg-background hover:bg-accent transition-colors"
          )}
        >
          <RefreshCw className="w-4 h-4" />
          Tạo lại
        </button>
      )}
    </div>
  );
}
