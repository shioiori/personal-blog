"use client";

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { Input } from "@/src/components/ui/Input";
import type { EnglishWord } from "@/src/declaration/english";

interface WordChecklistProps {
  words: EnglishWord[];
  selected: number[];
  onChange: (ids: number[]) => void;
  /** Words already included some other way (e.g. via a picked group): shown ticked and not toggleable. */
  lockedIds?: Set<number>;
}

const PAGE = 150;

// Searchable list of words with checkboxes; "select all / clear" act on the
// words currently shown by the search. Built to stay fast with thousands of
// words: plain checkboxes, memoised rows, and only the first rows rendered
// until "show more".
export function WordChecklist({ words, selected, onChange, lockedIds }: WordChecklistProps) {
  const t = useTranslations("English");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [limit, setLimit] = useState(PAGE);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const shown = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    const list = q
      ? words.filter((w) => [w.word, w.altSpelling ?? ""].some((v) => v.toLowerCase().includes(q)))
      : words;
    return [...list].sort((a, b) => a.word.localeCompare(b.word));
  }, [words, deferredSearch]);

  useEffect(() => setLimit(PAGE), [deferredSearch]);

  const includedCount = useMemo(
    () => words.reduce((n, w) => n + (selectedSet.has(w.id) || lockedIds?.has(w.id) ? 1 : 0), 0),
    [words, selectedSet, lockedIds]
  );

  // Stable toggle so unchanged rows don't re-render.
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const toggle = useCallback((id: number, on: boolean) => {
    const cur = selectedRef.current;
    onChangeRef.current(on ? [...cur, id] : cur.filter((x) => x !== id));
  }, []);

  function selectShown() {
    const add = shown.map((w) => w.id).filter((id) => !selectedSet.has(id) && !lockedIds?.has(id));
    onChange([...selected, ...add]);
  }

  function clearShown() {
    const drop = new Set(shown.map((w) => w.id));
    onChange(selected.filter((id) => !drop.has(id)));
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("Common.searchWord")}
          className="pl-8 pr-8 h-8"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{t("Listen.selectedCount", { count: includedCount, total: words.length })}</span>
        <div className="flex gap-3">
          <button type="button" className="hover:text-foreground underline-offset-2 hover:underline" onClick={selectShown}>
            {t("Listen.selectAll")}
          </button>
          <button type="button" className="hover:text-foreground underline-offset-2 hover:underline" onClick={clearShown}>
            {t("Listen.clearAll")}
          </button>
        </div>
      </div>
      <div className="max-h-64 overflow-y-auto rounded-md border border-border divide-y divide-border">
        {shown.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">{t("Words.noWords")}</p>
        ) : (
          <>
            {shown.slice(0, limit).map((w) => (
              <Row
                key={w.id}
                word={w}
                checked={selectedSet.has(w.id)}
                locked={lockedIds?.has(w.id) ?? false}
                lockedLabel={t("Listen.inPickedGroup")}
                onToggle={toggle}
              />
            ))}
            {shown.length > limit && (
              <button
                type="button"
                onClick={() => setLimit((l) => l + PAGE * 2)}
                className="w-full py-2 text-xs text-primary hover:bg-muted/50"
              >
                {t("Listen.showMore", { count: shown.length - limit })}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const Row = memo(function Row({
  word,
  checked,
  locked,
  lockedLabel,
  onToggle,
}: {
  word: EnglishWord;
  checked: boolean;
  locked: boolean;
  lockedLabel: string;
  onToggle: (id: number, on: boolean) => void;
}) {
  return (
    <label className={`flex items-center gap-2 px-3 py-1.5 text-sm ${locked ? "opacity-60" : "cursor-pointer hover:bg-muted/50"}`}>
      <input
        type="checkbox"
        className="h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
        checked={locked || checked}
        disabled={locked}
        onChange={(e) => onToggle(word.id, e.target.checked)}
      />
      <span className="font-medium">{word.word}</span>
      {locked ? (
        <span className="text-[10px] uppercase text-muted-foreground">{lockedLabel}</span>
      ) : (
        word.senses[0]?.meaningVi && <span className="text-xs text-muted-foreground truncate">{word.senses[0].meaningVi}</span>
      )}
    </label>
  );
});
