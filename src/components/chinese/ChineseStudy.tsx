"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { getAllCharacters, type CharacterInfo, type HskLevel } from "@/src/data/chinese";
import { RadicalGroup } from "./RadicalGroup";
import { CharacterCard } from "./CharacterCard";
import type { UserEdits } from "./EditCardModal";
import { useEditAuth } from "./useEditAuth";
import { KeyPromptModal } from "./KeyPromptModal";
import { ReviewTab } from "./ReviewTab";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/Select";
import { Checkbox } from "@/src/components/ui/Checkbox";
import { cn } from "@/src/utils/ui";
import { Search } from "lucide-react";

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`GET ${path} failed`);
  return res.json() as Promise<T>;
}

async function apiPost(path: string, body: unknown): Promise<void> {
  await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const HSK_ORDER: Record<HskLevel, number> = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, beyond: 7 };
const byFreq = (a: CharacterInfo, b: CharacterInfo) => {
  const ra = a.frequencyRank ?? Infinity;
  const rb = b.frequencyRank ?? Infinity;
  return ra !== rb ? ra - rb : HSK_ORDER[a.hsk] - HSK_ORDER[b.hsk];
};
const HSK_OPTIONS = ["Tất cả", "HSK 1", "HSK 2", "HSK 3", "HSK 4", "HSK 5", "HSK 6", "Không rõ"] as const;

type ViewMode = "all" | "byRadical" | "review";

interface RadicalGroupData {
  radical: string;
  radicalName: string;
  chars: CharacterInfo[];
}

export function ChineseStudy() {
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [hskFilter, setHskFilter] = useState<HskLevel | "all">("all");
  const [selectedRadical, setSelectedRadical] = useState<string>("");
  const [charSearch, setCharSearch] = useState("");
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [hiddenCards, setHiddenCards] = useState<Set<string>>(new Set());
  const [showKnownOnly, setShowKnownOnly] = useState(false);
  const [showKnownCardsOnly, setShowKnownCardsOnly] = useState(false);
  const [userEdits, setUserEdits] = useState<Record<string, UserEdits>>({});
  const [loaded, setLoaded] = useState(false);
  const { auth, requestEdit, submitKey, dismiss } = useEditAuth();

  // Load persisted state from Neon on mount
  useEffect(() => {
    Promise.all([
      apiGet<Record<string, boolean>>("/api/chinese/state"),
      apiGet<Record<string, UserEdits>>("/api/chinese/edits"),
    ]).then(([states, edits]) => {
      const hidden = new Set(Object.entries(states).filter(([, v]) => v).map(([k]) => k));
      setHiddenCards(hidden);
      setUserEdits(edits);
    }).catch(() => {/* silently ignore — work offline */}).finally(() => setLoaded(true));
  }, []);

  const allChars = useMemo(() => getAllCharacters(), []);

  const filtered = useMemo(() => {
    if (hskFilter === "all") return allChars;
    return allChars.filter((c) => c.hsk === hskFilter);
  }, [allChars, hskFilter]);

  const radicalGroups = useMemo((): RadicalGroupData[] => {
    const map = new Map<string, RadicalGroupData>();
    for (const c of filtered) {
      const key = c.radical || "__unknown__";
      if (!map.has(key)) {
        map.set(key, { radical: key, radicalName: c.radicalName, chars: [] });
      }
      map.get(key)!.chars.push(c);
    }
    for (const g of map.values()) {
      g.chars.sort(byFreq);
    }
    return [...map.values()].sort((a, b) => byFreq(a.chars[0], b.chars[0]));
  }, [filtered]);

  const visibleGroups = useMemo(() => {
    if (!showKnownOnly) return radicalGroups;
    return radicalGroups.filter((g) => g.chars.some((c) => hiddenCards.has(c.char)));
  }, [radicalGroups, showKnownOnly, hiddenCards]);

  // Auto-select first radical in mode 2
  useEffect(() => {
    if (viewMode === "byRadical" && visibleGroups.length > 0) {
      const valid = visibleGroups.find((g) => g.radical === selectedRadical);
      if (!valid) setSelectedRadical(visibleGroups[0].radical);
    }
  }, [viewMode, visibleGroups, selectedRadical]);

  const handleToggleHide = useCallback((char: string) => {
    setHiddenCards((prev) => {
      const next = new Set(prev);
      const nowHidden = !next.has(char);
      if (nowHidden) next.add(char);
      else next.delete(char);
      void apiPost("/api/chinese/state", { char, hidden: nowHidden });
      return next;
    });
  }, []);

  const handleSave = useCallback((char: string, edits: UserEdits) => {
    setUserEdits((prev) => {
      const merged = { ...(prev[char] ?? {}), ...edits };
      void apiPost("/api/chinese/edits", { char, edits: merged });
      return { ...prev, [char]: merged };
    });
  }, []);

  const handleToggleGroup = useCallback((radical: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(radical)) next.delete(radical);
      else next.add(radical);
      return next;
    });
  }, []);

  const selectedGroupChars = useMemo(() => {
    const g = visibleGroups.find((g) => g.radical === selectedRadical);
    return g?.chars ?? [];
  }, [visibleGroups, selectedRadical]);

  const handleNavigate = useCallback(
    (char: string) => {
      const charData = allChars.find((c) => c.char === char);
      if (!charData) return;

      if (viewMode === "all") {
        // Open the group containing this char, then scroll to card
        setOpenGroups((prev) => new Set([...prev, charData.radical]));
        // Scroll after state update + DOM paint
        setTimeout(() => {
          document.getElementById(`char-${char}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 150);
      } else {
        // Switch to the radical of this char, then scroll to card
        setSelectedRadical(charData.radical);
        setTimeout(() => {
          document.getElementById(`char-${char}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 150);
      }
    },
    [allChars, viewMode]
  );

  const hskFilterValue = (opt: string): HskLevel | "all" => {
    if (opt === "Tất cả") return "all";
    if (opt === "Không rõ") return "beyond";
    return parseInt(opt.split(" ")[1]) as HskLevel;
  };

  const handleCharSearch = useCallback((val: string) => {
    setCharSearch(val.slice(0, 1));
  }, []);

  const executeCharSearch = useCallback(() => {
    if (!charSearch) return;
    const found = allChars.find((c) => c.char === charSearch);
    if (found) setSelectedRadical(found.radical || "__unknown__");
  }, [charSearch, allChars]);

  const handleRadicalChange = useCallback((val: string) => {
    setSelectedRadical(val);
    setCharSearch("");
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1
            className="text-3xl font-bold"
            style={{ fontFamily: "var(--font-noto-serif-sc), serif" }}
          >
            漢字
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length.toLocaleString()} ký tự · {visibleGroups.length} bộ thủ
            {!loaded && <span className="ml-2 opacity-50">· Đang tải...</span>}
          </p>
        </div>

        {/* Toolbar */}
        <div className="space-y-3">
          {/* Row 1: view mode + HSK pills */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
              <button
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors",
                  viewMode === "all"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-accent"
                )}
                onClick={() => setViewMode("all")}
              >
                Hiện all
              </button>
              <button
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors border-l border-border",
                  viewMode === "byRadical"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-accent"
                )}
                onClick={() => setViewMode("byRadical")}
              >
                Theo bộ thủ
              </button>
              <button
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors border-l border-border",
                  viewMode === "review"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-accent"
                )}
                onClick={() => setViewMode("review")}
              >
                Ôn tập
              </button>
            </div>

            {viewMode !== "review" && (
              <div className="flex flex-wrap gap-1.5">
                {HSK_OPTIONS.map((opt) => {
                  const val = hskFilterValue(opt);
                  return (
                    <button
                      key={opt}
                      onClick={() => setHskFilter(val)}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                        hskFilter === val
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-transparent border-border text-muted-foreground hover:bg-accent"
                      )}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Row 2: checkboxes — hidden in review mode */}
          {viewMode !== "review" && (
            <div className="flex flex-wrap gap-4 items-center">
              <label className="flex items-center gap-2 cursor-pointer shrink-0">
                <Checkbox
                  checked={showKnownOnly}
                  onCheckedChange={(v) => setShowKnownOnly(Boolean(v))}
                />
                <span className="text-sm text-muted-foreground select-none">
                  Chỉ hiện bộ thủ có từ đã biết
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer shrink-0">
                <Checkbox
                  checked={showKnownCardsOnly}
                  onCheckedChange={(v) => setShowKnownCardsOnly(Boolean(v))}
                />
                <span className="text-sm text-muted-foreground select-none">
                  Chỉ hiện từ đã biết
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Review tab content */}
        {viewMode === "review" && <ReviewTab />}

        {/* Radical selector + search for mode 2 */}
        {viewMode === "byRadical" && (
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="text"
              value={charSearch}
              onChange={(e) => handleCharSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && executeCharSearch()}
              placeholder="Nhập 1 từ..."
              maxLength={1}
              className={cn(
                "w-64 h-10 px-3 text-lg rounded-md border border-border bg-background",
                "text-center focus:outline-none focus:ring-2 focus:ring-primary/50",
                "placeholder:text-sm placeholder:text-muted-foreground"
              )}
              style={{ fontFamily: "var(--font-noto-serif-sc), serif" }}
            />
            <button
              onClick={executeCharSearch}
              className={cn(
                "h-10 px-4 flex items-center gap-2 rounded-md border border-border bg-background",
                "text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              )}
            >
              <Search className="w-4 h-4" />
              Tìm
            </button>
            <Select value={selectedRadical} onValueChange={handleRadicalChange}>
              <SelectTrigger className="w-64 h-10">
                <SelectValue placeholder="Chọn bộ thủ..." />
              </SelectTrigger>
              <SelectContent>
                {visibleGroups.map((g) => (
                  <SelectItem key={g.radical} value={g.radical}>
                    <span style={{ fontFamily: "var(--font-noto-serif-sc), serif" }}>
                      {g.radical === "__unknown__" ? "?" : g.radical}
                    </span>
                    {" "}({g.chars.length})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Content (study modes only) */}
        {viewMode !== "review" && (
          viewMode === "all" ? (
            <div className="space-y-2">
              {visibleGroups.map((g) => (
                <RadicalGroup
                  key={g.radical}
                  radical={g.radical}
                  radicalName={g.radicalName}
                  characters={g.chars}
                  isOpen={openGroups.has(g.radical)}
                  onToggle={handleToggleGroup}
                  hiddenCards={hiddenCards}
                  showKnownOnly={showKnownCardsOnly}
                  onToggleHide={handleToggleHide}
                  onNavigate={handleNavigate}
                  onSave={handleSave}
                  userEdits={userEdits}
                  onEditRequest={requestEdit}
                  editLocked={auth.status === "locked"}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {(showKnownCardsOnly ? selectedGroupChars.filter((c) => hiddenCards.has(c.char)) : selectedGroupChars).map((c) => (
                <CharacterCard
                  key={c.char}
                  info={c}
                  edits={userEdits[c.char] ?? {}}
                  hidden={hiddenCards.has(c.char)}
                  onToggleHide={handleToggleHide}
                  onNavigate={handleNavigate}
                  onSave={handleSave}
                  onEditRequest={requestEdit}
                  editLocked={auth.status === "locked"}
                />
              ))}
            </div>
          )
        )}

        {viewMode !== "review" && visibleGroups.length === 0 && (
          <p className="text-center text-muted-foreground py-16">
            {showKnownOnly
          ? "Chưa có từ nào được đánh dấu đã biết. Ấn vào card để ẩn pinyin và nghĩa."
          : "Không có bộ thủ nào phù hợp với bộ lọc hiện tại."}
          </p>
        )}

        {/* Attribution */}
        <p className="text-xs text-muted-foreground/60 text-center pt-4">
          Data: CC-CEDICT (CC BY-SA 3.0) · HSK vocabulary list
        </p>
      </div>

      {/* Key prompt modal */}
      {auth.status === "prompting" && (
        <KeyPromptModal
          onSubmit={submitKey}
          onDismiss={dismiss}
        />
      )}
    </div>
  );
}
