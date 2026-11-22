"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Languages, X, Trash2 } from "lucide-react";
import { useEnglishLookup } from "@/src/context/englishLookup";
import { useMusicContext } from "@/src/context/music";
import { Switch } from "@/src/components/ui/Switch";
import { Input } from "@/src/components/ui/Input";
import { Button } from "@/src/components/ui/Button";
import { ScrollArea } from "@/src/components/ui/ScrollArea";
import { cn } from "@/src/utils/ui";

export function FloatingLookupBox() {
  const {
    isFloatingVisible,
    isBoxExpanded,
    setIsBoxExpanded,
    explainMode,
    setExplainMode,
    history,
    isLoading,
    lookup,
    clearHistory,
  } = useEnglishLookup();
  const { isFloatingVisible: musicVisible, isBoxExpanded: musicExpanded } = useMusicContext();
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const stackedAboveMusic = musicVisible && musicExpanded;

  // Portal to <body> so this isn't visually clipped by the root layout's
  // `overflow-x-hidden` container (which Chromium also clips `position:
  // fixed` descendants against, even though only the x-axis is hidden).
  useEffect(() => setMounted(true), []);

  if (!isFloatingVisible || !mounted) return null;

  if (!isBoxExpanded) {
    return createPortal(
      <button
        onClick={() => setIsBoxExpanded(true)}
        className={cn(
          "fixed right-6 z-50 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-110 transition-[bottom,transform]",
          stackedAboveMusic ? "bottom-48" : "bottom-24",
        )}
        title="Tra cứu / dịch nhanh"
      >
        <Languages className="h-5 w-5" />
      </button>,
      document.body,
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query;
    setQuery("");
    await lookup(q);
  }

  return createPortal(
    <div
      className={cn(
        "fixed right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] max-w-80 rounded-2xl bg-background/95 backdrop-blur border border-border shadow-xl overflow-hidden flex flex-col max-h-[70vh] transition-[bottom]",
        stackedAboveMusic ? "bottom-44 sm:bottom-48" : "bottom-20 sm:bottom-24",
      )}
    >
      <div className="p-3 border-b border-border flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium tracking-wide uppercase flex items-center gap-1.5">
          <Languages className="h-3.5 w-3.5" />
          Tra cứu / dịch
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={clearHistory}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Xoá lịch sử"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setIsBoxExpanded(false)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Thu nhỏ"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">Chế độ giải thích</span>
        <Switch checked={explainMode} onCheckedChange={setExplainMode} />
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-3">
          {history.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Gõ từ/cụm/câu tiếng Việt hoặc tiếng Anh để dịch 2 chiều.
            </p>
          )}
          {history.map((entry) => (
            <div key={entry.id} className="text-sm space-y-1">
              <p className="text-muted-foreground text-xs">{entry.query}</p>
              <p className="font-medium">{entry.result}</p>
              {entry.explanation && (
                <p className="text-xs text-muted-foreground italic">{entry.explanation}</p>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      <form onSubmit={handleSubmit} className="p-3 border-t border-border flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nhập từ/câu cần tra..."
          className="text-sm"
        />
        <Button type="submit" size="sm" disabled={isLoading || !query.trim()}>
          {isLoading ? "..." : "Tra"}
        </Button>
      </form>
    </div>,
    document.body,
  );
}
