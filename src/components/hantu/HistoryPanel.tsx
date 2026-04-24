"use client";

import { Trash2, Clock } from "lucide-react";
import { Button } from "@/src/components/ui/Button";

export interface HistoryEntry {
  char: string;
  hanViet: string | null;
  timestamp: number;
}

interface HistoryPanelProps {
  history: HistoryEntry[];
  onSelect: (char: string) => void;
  onClear: () => void;
}

export function HistoryPanel({ history, onSelect, onClear }: HistoryPanelProps) {
  if (history.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Đã tra gần đây</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-7 px-2 text-muted-foreground hover:text-destructive gap-1"
        >
          <Trash2 className="h-3 w-3" />
          Xóa lịch sử
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {history.map((entry) => (
          <button
            key={`${entry.char}-${entry.timestamp}`}
            onClick={() => onSelect(entry.char)}
            className="flex flex-col items-center gap-0.5 rounded-xl border border-border bg-background hover:bg-accent hover:border-primary/50 transition-colors px-3 py-2 min-w-[52px]"
          >
            <span
              className="text-2xl font-bold leading-none"
              style={{ fontFamily: "var(--font-noto-serif-sc), 'SimSun', 'STSong', serif" }}
            >
              {entry.char}
            </span>
            {entry.hanViet && (
              <span className="text-[10px] text-muted-foreground">{entry.hanViet}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
