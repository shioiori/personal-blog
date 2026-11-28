"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { Input } from "@/src/components/ui/Input";
import { Checkbox } from "@/src/components/ui/Checkbox";
import type { EnglishWord } from "@/src/declaration/english";

interface WordChecklistProps {
  words: EnglishWord[];
  selected: number[];
  onChange: (ids: number[]) => void;
}

// Searchable list of words with checkboxes; "select all / clear" act on the
// words currently shown by the search.
export function WordChecklist({ words, selected, onChange }: WordChecklistProps) {
  const t = useTranslations("English");
  const [search, setSearch] = useState("");
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? words.filter((w) => [w.word, w.altSpelling ?? ""].some((v) => v.toLowerCase().includes(q)))
      : words;
    return [...list].sort((a, b) => a.word.localeCompare(b.word));
  }, [words, search]);

  const selectedHere = words.filter((w) => selectedSet.has(w.id)).length;

  function toggle(id: number, on: boolean) {
    onChange(on ? [...selected, id] : selected.filter((x) => x !== id));
  }

  function selectShown() {
    const add = shown.map((w) => w.id).filter((id) => !selectedSet.has(id));
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
        <span>{t("Listen.selectedCount", { count: selectedHere, total: words.length })}</span>
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
          shown.map((w) => (
            <label key={w.id} className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-muted/50">
              <Checkbox checked={selectedSet.has(w.id)} onCheckedChange={(v) => toggle(w.id, v === true)} />
              <span className="font-medium">{w.word}</span>
              {w.senses[0]?.meaningVi && (
                <span className="text-xs text-muted-foreground truncate">{w.senses[0].meaningVi}</span>
              )}
            </label>
          ))
        )}
      </div>
    </div>
  );
}
