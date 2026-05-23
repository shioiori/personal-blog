"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { TooltipMode } from "@/src/components/enums";
import { CharTooltip } from "../study/CharTooltip";
import type { CharacterInfo } from "@/src/data/chinese";
import type { UserEdits } from "../study/EditCardModal";
import { CHINESE_REVIEW_TEXT } from "@/src/constants";

interface HistoryItem {
  id: number;
  text: string;
  learnedCount: number;
  createdAt: string;
}

interface HistoryTabProps {
  allChars: CharacterInfo[];
  userEdits: Record<string, UserEdits>;
}

function isChinese(ch: string) {
  const code = ch.codePointAt(0) ?? 0;
  return (code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf);
}

function ReviewText({ text, charMap, userEdits, mode }: {
  text: string;
  charMap: Map<string, CharacterInfo>;
  userEdits: Record<string, UserEdits>;
  mode: TooltipMode;
}) {
  return (
    <p className="text-xl leading-relaxed" style={{ fontFamily: "var(--font-noto-serif-sc), serif" }}>
      {Array.from(text).map((ch, i) => {
        const info = isChinese(ch) ? charMap.get(ch) : undefined;
        if (info && mode !== TooltipMode.Off) {
          return <CharTooltip key={i} char={ch} info={info} edits={userEdits[ch] ?? {}} mode={mode} />;
        }
        return <span key={i}>{ch}</span>;
      })}
    </p>
  );
}

function HistoryItem({ item, charMap, userEdits, tooltipMode, onDelete }: {
  item: HistoryItem;
  charMap: Map<string, CharacterInfo>;
  userEdits: Record<string, UserEdits>;
  tooltipMode: TooltipMode;
  onDelete: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const chineseChars = Array.from(item.text).filter(isChinese);
  const preview = chineseChars.slice(0, 10).join("");
  const date = new Date(item.createdAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-accent transition-colors cursor-pointer"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="shrink-0 text-muted-foreground">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
        <span className="text-sm font-medium flex-1" style={{ fontFamily: "var(--font-noto-serif-sc), serif" }}>
          {preview}
        </span>
        <span className="text-xs text-muted-foreground shrink-0">{date}</span>
        <span onClick={(e) => e.stopPropagation()}>
          <button
            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors ml-1"
            onClick={() => onDelete(item.id)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </span>
      </div>

      {open && (
        <div className="px-6 py-4 border-t border-border">
          <p className="text-xs text-muted-foreground mb-3">{item.learnedCount} từ đã học</p>
          <ReviewText text={item.text} charMap={charMap} userEdits={userEdits} mode={tooltipMode} />
        </div>
      )}
    </div>
  );
}

export function HistoryTab({ allChars, userEdits }: HistoryTabProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tooltipMode, setTooltipMode] = useState<TooltipMode>(TooltipMode.Full);

  const charMap = new Map(allChars.map((c) => [c.char, c]));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/chinese/review-history");
      const data = await res.json() as { history?: HistoryItem[] };
      setHistory(data.history ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const run = async () => {
      let localText: string | null = null;
      let localCount = 0;
      try {
        const raw = localStorage.getItem(CHINESE_REVIEW_TEXT);
        if (raw) {
          const parsed = JSON.parse(raw) as { text: string; learnedCount: number };
          localText = parsed.text ?? null;
          localCount = parsed.learnedCount ?? 0;
        }
      } catch {
        // ignore
      }

      if (localText) {
        const res = await fetch("/api/chinese/review-history");
        const data = await res.json() as { history?: HistoryItem[] };
        const items = data.history ?? [];
        const alreadySaved = items.some((h) => h.text === localText);
        if (!alreadySaved) {
          await fetch("/api/chinese/review-history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: localText, learnedCount: localCount }),
          });
          const finalRes = await fetch("/api/chinese/review-history");
          const finalData = await finalRes.json() as { history?: HistoryItem[] };
          setHistory(finalData.history ?? []);
        } else {
          setHistory(items);
        }
        setLoading(false);
      } else {
        await load();
      }
    };
    void run();
  }, [load]);

  const handleDelete = useCallback(async (id: number) => {
    await fetch("/api/chinese/review-history", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setHistory((prev) => prev.filter((h) => h.id !== id));
  }, []);

  const modeOptions: { value: TooltipMode; label: string }[] = [
    { value: TooltipMode.Full, label: "Hiện đầy đủ" },
    { value: TooltipMode.NoPinyin, label: "Ẩn pinyin" },
    { value: TooltipMode.NoMeaning, label: "Ẩn nghĩa" },
    { value: TooltipMode.Off, label: "Không hiện" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        {modeOptions.map((opt) => (
          <label key={opt.value} className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="radio"
              name="history-tooltip-mode"
              value={opt.value}
              checked={tooltipMode === opt.value}
              onChange={() => setTooltipMode(opt.value)}
              className="accent-primary"
            />
            {opt.label}
          </label>
        ))}
      </div>

      {loading && (
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          <div className="w-6 h-6 border-2 border-border border-t-foreground rounded-full animate-spin" />
          <p className="text-sm">Đang tải...</p>
        </div>
      )}

      {!loading && history.length === 0 && (
        <div className="py-20 text-center text-muted-foreground text-sm">Chưa có đoạn văn nào được lưu.</div>
      )}

      {!loading && history.length > 0 && (
        <div className="space-y-2">
          {history.map((item) => (
            <HistoryItem
              key={item.id}
              item={item}
              charMap={charMap}
              userEdits={userEdits}
              tooltipMode={tooltipMode}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
