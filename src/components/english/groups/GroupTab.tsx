"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/src/components/ui/Dialog";
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, X } from "lucide-react";
import { useEnglishStudy } from "@/src/context/english";
import { cn } from "@/src/utils/ui";
import type { EnglishGroup, EnglishWord } from "@/src/declaration/english";

interface CreateGroupDialogProps {
  open: boolean;
  initial?: string;
  onClose: () => void;
  onSave: (name: string) => void;
}

function CreateGroupDialog({ open, initial, onClose, onSave }: CreateGroupDialogProps) {
  const [name, setName] = useState(initial ?? "");

  useEffect(() => {
    if (open) setName(initial ?? "");
  }, [open, initial]);

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>{initial ? "Đổi tên nhóm" : "Tạo nhóm mới"}</DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tên nhóm</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="vd: Từ vựng IELTS"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Huỷ</Button>
          <Button onClick={handleSave} disabled={!name.trim()}>{initial ? "Lưu" : "Tạo"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface AddWordsDialogProps {
  open: boolean;
  group: EnglishGroup | null;
  allWords: EnglishWord[];
  onClose: () => void;
  onAdd: (wordIds: number[]) => void;
}

function AddWordsDialog({ open, group, allWords, onClose, onAdd }: AddWordsDialogProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (open) {
      setSearch("");
      setSelected(new Set());
    }
  }, [open]);

  const candidates = useMemo(() => {
    const memberSet = new Set(group?.wordIds ?? []);
    return allWords
      .filter((w) => !memberSet.has(w.id))
      .filter((w) => !search.trim() || w.word.toLowerCase().includes(search.trim().toLowerCase()));
  }, [allWords, group, search]);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleAdd() {
    if (selected.size === 0) return;
    onAdd([...selected]);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg flex flex-col max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Thêm từ vào nhóm &quot;{group?.name}&quot;</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm từ..." />
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Không có từ phù hợp.</p>
            ) : (
              candidates.map((w) => (
                <label
                  key={w.id}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm",
                    selected.has(w.id) ? "bg-primary/10" : "hover:bg-accent"
                  )}
                >
                  <input type="checkbox" checked={selected.has(w.id)} onChange={() => toggle(w.id)} className="shrink-0" />
                  <span className="font-medium">{w.word}</span>
                  {w.senses[0]?.meaningVi && (
                    <span className="text-xs text-muted-foreground truncate">{w.senses[0].meaningVi}</span>
                  )}
                </label>
              ))
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Huỷ</Button>
          <Button onClick={handleAdd} disabled={selected.size === 0}>
            Thêm {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function GroupTab() {
  const { words, groups, loaded, refetchGroups, refetchWords } = useEnglishStudy();
  const [openGroups, setOpenGroups] = useState<Set<number>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<EnglishGroup | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<EnglishGroup | null>(null);

  const wordMap = useMemo(() => new Map(words.map((w) => [w.id, w])), [words]);

  function toggleGroup(id: number) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleCreateGroup(name: string) {
    await fetch("/api/english/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    await refetchGroups();
  }

  async function handleRenameGroup(name: string) {
    if (!editingGroup) return;
    await fetch(`/api/english/groups/${editingGroup.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    await refetchGroups();
  }

  async function handleDeleteGroup(id: number) {
    await fetch(`/api/english/groups/${id}`, { method: "DELETE" });
    await refetchGroups();
  }

  async function handleAddWords(wordIds: number[]) {
    if (!activeGroup) return;
    await fetch(`/api/english/groups/${activeGroup.id}/words`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wordIds }),
    });
    await Promise.all([refetchGroups(), refetchWords()]);
  }

  async function handleRemoveWord(groupId: number, wordId: number) {
    await fetch(`/api/english/groups/${groupId}/words`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wordId }),
    });
    await Promise.all([refetchGroups(), refetchWords()]);
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
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Tạo nhóm
        </Button>
      </div>

      {groups.length === 0 ? (
        <p className="text-center text-muted-foreground py-16">Chưa có nhóm nào. Nhấn &quot;Tạo nhóm&quot; để bắt đầu.</p>
      ) : (
        <div className="space-y-2">
          {groups.map((group) => {
            const isOpen = openGroups.has(group.id);
            return (
              <div key={group.id} className="rounded-lg border border-border overflow-hidden">
                <div
                  role="button"
                  tabIndex={0}
                  className="w-full flex items-center gap-2 px-4 py-3 bg-muted/50 hover:bg-muted transition-colors text-left cursor-pointer"
                  onClick={() => toggleGroup(group.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleGroup(group.id);
                    }
                  }}
                >
                  {isOpen ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                  <span className="font-medium text-sm">{group.name}</span>
                  <span className="text-xs text-muted-foreground ml-1">({group.wordIds.length})</span>
                  <div className="ml-auto flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors text-xs flex items-center gap-1"
                      onClick={() => { setActiveGroup(group); setAddOpen(true); }}
                    >
                      <Plus className="w-3.5 h-3.5" /> Thêm từ
                    </button>
                    <button
                      className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setEditingGroup(group)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      onClick={() => handleDeleteGroup(group.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {isOpen && (
                  <div className="p-3">
                    {group.wordIds.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">Chưa có từ nào. Nhấn &quot;Thêm từ&quot; để thêm.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {group.wordIds.map((wid) => {
                          const w = wordMap.get(wid);
                          if (!w) return null;
                          return (
                            <div key={wid} className="rounded-lg border border-border bg-card px-3 py-2 flex items-center gap-2 group">
                              <span className="text-sm font-medium">{w.word}</span>
                              <button
                                onClick={() => handleRemoveWord(group.id, wid)}
                                className="hidden group-hover:flex text-muted-foreground hover:text-destructive"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <CreateGroupDialog open={createOpen} onClose={() => setCreateOpen(false)} onSave={handleCreateGroup} />
      <CreateGroupDialog
        open={editingGroup !== null}
        initial={editingGroup?.name}
        onClose={() => setEditingGroup(null)}
        onSave={handleRenameGroup}
      />
      <AddWordsDialog open={addOpen} group={activeGroup} allWords={words} onClose={() => setAddOpen(false)} onAdd={handleAddWords} />
    </div>
  );
}
