"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Plus, Search, List, Layers, X, FolderCog } from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/src/components/ui/Dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/Select";
import { WordCard } from "./WordCard";
import { EditWordModal } from "./EditWordModal";
import { WordFlashcardView } from "./WordFlashcardView";
import { GroupTab } from "@/src/components/english/groups/GroupTab";
import { useEnglishStudy } from "@/src/context/english";
import type { EnglishWord } from "@/src/declaration/english";

type ViewMode = "list" | "flashcard";

export function WordList() {
  const t = useTranslations("English");
  const { words, groups, loaded, refetchWords } = useEnglishStudy();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWord, setEditingWord] = useState<EnglishWord | null>(null);
  const [startInEditMode, setStartInEditMode] = useState(false);
  const [groupManagerOpen, setGroupManagerOpen] = useState(false);

  const filtered = useMemo(() => {
    return words.filter((w) => {
      if (groupFilter === "none") {
        if (w.groupIds.length > 0) return false;
      } else if (groupFilter !== "all" && !w.groupIds.includes(parseInt(groupFilter, 10))) {
        return false;
      }
      const q = search.trim().toLowerCase();
      if (q && ![w.word, w.altSpelling ?? ""].some((v) => v.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [words, search, groupFilter]);

  async function handleDelete(id: number) {
    await fetch(`/api/english/words/${id}`, { method: "DELETE" });
    await refetchWords();
  }

  if (!loaded) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
        <div className="w-6 h-6 border-2 border-border border-t-foreground rounded-full animate-spin" />
        <p className="text-sm">{t("Common.loadingData")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Common.searchWord")}
            className="pl-8 pr-8"
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
        <Select value={groupFilter} onValueChange={setGroupFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("Words.allGroups")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("Words.allGroups")}</SelectItem>
            <SelectItem value="none">{t("Settings.ungrouped")}</SelectItem>
            {groups.map((g) => (
              <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={() => setGroupManagerOpen(true)}>
          <FolderCog className="w-3.5 h-3.5 mr-1" /> {t("Groups.manage")}
        </Button>
        <Button size="sm" onClick={() => { setEditingWord(null); setStartInEditMode(true); setModalOpen(true); }}>
          <Plus className="w-3.5 h-3.5 mr-1" /> {t("Common.addWord")}
        </Button>
        <div className="flex gap-1 border border-border rounded-md p-0.5">
          <Button
            size="sm"
            variant={viewMode === "list" ? "default" : "ghost"}
            className="h-7 px-2"
            onClick={() => setViewMode("list")}
          >
            <List className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="sm"
            variant={viewMode === "flashcard" ? "default" : "ghost"}
            className="h-7 px-2"
            onClick={() => setViewMode("flashcard")}
          >
            <Layers className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-16">{t("Words.emptyHint")}</p>
      ) : viewMode === "flashcard" ? (
        <WordFlashcardView words={filtered} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((w) => (
            <div
              key={w.id}
              onClick={() => { setEditingWord(w); setStartInEditMode(false); setModalOpen(true); }}
              className="cursor-pointer"
            >
              <WordCard
                word={w}
                onEdit={() => { setEditingWord(w); setStartInEditMode(true); setModalOpen(true); }}
                onDelete={() => handleDelete(w.id)}
              />
            </div>
          ))}
        </div>
      )}

      <EditWordModal
        open={modalOpen}
        word={editingWord}
        startInEditMode={startInEditMode}
        onClose={() => setModalOpen(false)}
        onDelete={handleDelete}
        onOpenWord={(id) => {
          const target = words.find((w) => w.id === id);
          if (target) {
            setEditingWord(target);
            setStartInEditMode(false);
          }
        }}
      />

      <Dialog open={groupManagerOpen} onOpenChange={setGroupManagerOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-2xl max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("Groups.manageTitle")}</DialogTitle>
          </DialogHeader>
          <GroupTab />
        </DialogContent>
      </Dialog>
    </div>
  );
}
