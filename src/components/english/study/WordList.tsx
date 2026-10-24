"use client";

import { useState, useMemo } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/Select";
import { WordCard } from "./WordCard";
import { EditWordModal } from "./EditWordModal";
import { useEnglishStudy } from "@/src/context/english";
import type { EnglishWord } from "@/src/declaration/english";

export function WordList() {
  const { words, groups, loaded, refetchWords } = useEnglishStudy();
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWord, setEditingWord] = useState<EnglishWord | null>(null);
  const [startInEditMode, setStartInEditMode] = useState(false);

  const filtered = useMemo(() => {
    return words.filter((w) => {
      if (groupFilter !== "all" && !w.groupIds.includes(parseInt(groupFilter, 10))) return false;
      if (search.trim() && !w.word.toLowerCase().includes(search.trim().toLowerCase())) return false;
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
        <p className="text-sm">Đang tải dữ liệu...</p>
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
            placeholder="Tìm từ..."
            className="pl-8"
          />
        </div>
        <Select value={groupFilter} onValueChange={setGroupFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tất cả nhóm" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả nhóm</SelectItem>
            {groups.map((g) => (
              <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => { setEditingWord(null); setStartInEditMode(true); setModalOpen(true); }}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Thêm từ
        </Button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-16">Chưa có từ nào. Nhấn &quot;Thêm từ&quot; để bắt đầu.</p>
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
      />
    </div>
  );
}
