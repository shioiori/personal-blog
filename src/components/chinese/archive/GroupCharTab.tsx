"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { CHINESE_DATA } from "@/src/data/chinese";
import type { CharGroup } from "@/src/lib/chinese-db";
import type { UserEdits } from "@/src/declaration/chinese";
import { Button } from "@/src/components/ui/Button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/src/components/ui/Dialog";
import { cn } from "@/src/utils/ui";
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, X } from "lucide-react";
import { useEditAuth } from "../study/useEditAuth";
import { KeyPromptModal } from "../study/KeyPromptModal";
import { useLearnedChars } from "@/src/context/chinese";

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`GET ${path} failed`);
  return res.json() as Promise<T>;
}

async function apiPost(body: unknown): Promise<Response> {
  return fetch("/api/chinese/char-groups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function apiDelete(body: unknown): Promise<void> {
  await fetch("/api/chinese/char-groups", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Char lookup by component ──────────────────────────────────────────────────

function findCharsByComponent(component: string): string[] {
  return Object.entries(CHINESE_DATA)
    .filter(([, info]) => info.radical === component || info.components?.includes(component))
    .sort(([, a], [, b]) => (a.frequencyRank ?? 9999) - (b.frequencyRank ?? 9999))
    .map(([char]) => char);
}

// ── Create group dialog ───────────────────────────────────────────────────────

interface CreateGroupDialogProps {
  open: boolean;
  initial?: string;
  onClose: () => void;
  onSave: (name: string) => void;
}

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function firstCodePoint(value: string) {
  return Array.from(value.trim())[0] ?? "";
}

function isSingleCodePoint(value: string) {
  return Array.from(value.trim()).length === 1;
}

function CreateGroupDialog({ open, initial, onClose, onSave }: CreateGroupDialogProps) {
  const [name, setName] = useState(initial ?? "");

  useEffect(() => { if (open) setName(initial ?? ""); }, [open, initial]);

  function handleSave() {
    const nextName = firstCodePoint(name);
    if (!nextName) return;
    onSave(nextName);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>{initial ? "Đổi tên nhóm" : "Tạo nhóm mới"}</DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tên nhóm (1 ký tự)</label>
          <input
            value={name}
            onChange={(e) => setName(firstCodePoint(e.target.value))}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="Nhập 1 ký tự..."
            style={name ? { fontFamily: "'Noto Serif SC', serif", fontSize: "1.5rem" } : undefined}
            className={inputCls}
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

// ── Add chars dialog ──────────────────────────────────────────────────────────

interface AddCharsDialogProps {
  open: boolean;
  group: CharGroup | null;
  onClose: () => void;
  onAdd: (chars: string[]) => void;
}

function AddCharsDialog({ open, group, onClose, onAdd }: AddCharsDialogProps) {
  const [tab, setTab] = useState<"radical" | "input">("radical");
  const [selectedChars, setSelectedChars] = useState<Set<string>>(new Set());
  const [inputRows, setInputRows] = useState<string[]>([""]);

  useEffect(() => {
    if (open) {
      setSelectedChars(new Set());
      setInputRows([""]);
      setTab("radical");
    }
  }, [open]);

  const componentChars = useMemo(() => {
    if (!group?.name.trim()) return [];
    return findCharsByComponent(group.name.trim());
  }, [group?.name]);

  function toggleChar(ch: string) {
    setSelectedChars((prev) => {
      const next = new Set(prev);
      if (next.has(ch)) next.delete(ch); else next.add(ch);
      return next;
    });
  }

  function handleAdd() {
    const fromRadical = [...selectedChars];
    const fromInput = inputRows.map(firstCodePoint).filter(Boolean);
    const all = [...new Set([...fromRadical, ...fromInput])];
    if (all.length === 0) return;
    onAdd(all);
    onClose();
  }

  function addInputRow() {
    setInputRows((prev) => [...prev, ""]);
  }

  function updateInputRow(i: number, val: string) {
    setInputRows((prev) => prev.map((r, idx) => (idx === i ? firstCodePoint(val) : r)));
  }

  function removeInputRow(i: number) {
    setInputRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  const totalSelected =
    selectedChars.size + inputRows.filter(isSingleCodePoint).length;

  const allSelected = useMemo(() => {
    const fromInput = inputRows.map(firstCodePoint).filter(Boolean);
    return [...new Set([...selectedChars, ...fromInput])];
  }, [selectedChars, inputRows]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg flex flex-col max-h-[85vh]">
        <DialogHeader className="shrink-0">
          <DialogTitle>Thêm từ vào nhóm &quot;{group?.name}&quot;</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1">
          {/* Tab switcher */}
          <div className="flex rounded-lg border border-border overflow-hidden w-fit">
            <button
              className={cn("px-4 py-1.5 text-sm font-medium transition-colors", tab === "radical" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-accent")}
              onClick={() => setTab("radical")}
            >
              Theo bộ thủ
            </button>
            <button
              className={cn("px-4 py-1.5 text-sm font-medium transition-colors border-l border-border", tab === "input" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-accent")}
              onClick={() => setTab("input")}
            >
              Nhập thủ công
            </button>
          </div>

          {tab === "radical" && (
            <div>
              {componentChars.length === 0 ? (
                <p className="text-sm text-muted-foreground">Không tìm thấy chữ nào chứa &quot;{group?.name}&quot;.</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mb-2">{componentChars.length} chữ chứa &quot;{group?.name}&quot;</p>
                  <div className="flex flex-wrap gap-1">
                    {componentChars.map((ch) => (
                      <button
                        key={ch}
                        onClick={() => toggleChar(ch)}
                        className={cn(
                          "w-8 h-8 rounded border text-sm transition-colors",
                          selectedChars.has(ch)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border bg-background hover:bg-accent"
                        )}
                        style={{ fontFamily: "'Noto Serif SC', serif" }}
                      >
                        {ch}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {tab === "input" && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Mỗi ô nhập 1 ký tự.</p>
              <div className="flex flex-wrap gap-2">
                {inputRows.map((val, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <input
                      value={val}
                      onChange={(e) => updateInputRow(i, e.target.value)}
                      className="w-10 h-10 rounded-md border border-input bg-background text-center text-lg outline-none focus:ring-2 focus:ring-ring"
                      style={val ? { fontFamily: "'Noto Serif SC', serif" } : undefined}
                    />
                    {inputRows.length > 1 && (
                      <button onClick={() => removeInputRow(i)} className="text-muted-foreground hover:text-destructive">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addInputRow}
                  className="w-10 h-10 rounded-md border border-dashed border-border bg-background text-muted-foreground hover:bg-accent flex items-center justify-center"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Selected preview */}
          {allSelected.length > 0 && (
            <div className="space-y-1.5 pt-1 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Đã chọn ({allSelected.length})</p>
              <div className="flex flex-wrap gap-1">
                {allSelected.map((ch) => (
                  <span
                    key={ch}
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-sm border border-primary/20"
                    style={{ fontFamily: "'Noto Serif SC', serif" }}
                  >
                    {ch}
                    <button
                      onClick={() => {
                        if (selectedChars.has(ch)) toggleChar(ch);
                        else setInputRows((prev) => prev.map((r) => r === ch ? "" : r));
                      }}
                      className="ml-0.5 hover:text-destructive"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 pt-2 border-t border-border">
          <Button variant="ghost" onClick={onClose}>Huỷ</Button>
          <Button onClick={handleAdd} disabled={allSelected.length === 0}>Thêm {allSelected.length > 0 ? `(${allSelected.length})` : ""}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Mini char card ────────────────────────────────────────────────────────────

function CharMiniCard({ char, userEdits, onRemove }: { char: string; userEdits: Record<string, UserEdits>; onRemove: () => void }) {
  const info = CHINESE_DATA[char];
  const edits = userEdits[char] ?? {};
  const pinyin = edits.pinyin || info?.pinyin || "";
  const hanViet = edits.hanViet || info?.hanViet || "";
  const meaning = edits.meaningVi || info?.meaningVi || info?.meaning || "";

  return (
    <div className="rounded-lg border border-border bg-card p-3 flex flex-col gap-1 group w-28">
      <div className="flex items-start justify-between gap-1">
        <div className="text-2xl font-medium leading-tight" style={{ fontFamily: "'Noto Serif SC', serif" }}>{char}</div>
        <button
          onClick={onRemove}
          className="hidden group-hover:flex shrink-0 p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      {pinyin && <div className="text-xs text-muted-foreground">{pinyin}</div>}
      {hanViet && <div className="text-xs text-blue-500 dark:text-blue-400">{hanViet}</div>}
      {meaning && <div className="text-xs text-foreground/80 line-clamp-2">{meaning}</div>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function GroupCharTab() {
  const [groups, setGroups] = useState<CharGroup[]>([]);
  const [userEdits, setUserEdits] = useState<Record<string, UserEdits>>({});
  const [loaded, setLoaded] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<number>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CharGroup | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<CharGroup | null>(null);

  const { auth, requestEdit, submitKey, dismiss } = useEditAuth();
  const { markLearned } = useLearnedChars();
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (auth.status === "verified" && pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  }, [auth.status, pendingAction]);

  function withAuth(action: () => void) {
    if (requestEdit()) action();
    else setPendingAction(() => action);
  }

  useEffect(() => {
    Promise.all([
      apiFetch<CharGroup[]>("/api/chinese/char-groups"),
      apiFetch<Record<string, UserEdits>>("/api/chinese/edits"),
    ])
      .then(([gs, edits]) => { setGroups(gs); setUserEdits(edits); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const toggleGroup = useCallback((id: number) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  async function handleCreateGroup(name: string) {
    const res = await apiPost({ name });
    const created = (await res.json()) as CharGroup;
    setGroups((prev) => [...prev, created]);
  }

  async function handleRenameGroup(name: string) {
    if (!editingGroup) return;
    await fetch("/api/chinese/char-groups", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingGroup.id, name }),
    });
    setGroups((prev) => prev.map((g) => (g.id === editingGroup.id ? { ...g, name } : g)));
  }

  async function handleDeleteGroup(id: number) {
    await apiDelete({ id });
    setGroups((prev) => prev.filter((g) => g.id !== id));
  }

  async function handleAddChars(chars: string[]) {
    if (!activeGroup) return;
    await apiPost({ action: "addChars", groupId: activeGroup.id, chars });
    markLearned(chars);
    setGroups((prev) =>
      prev.map((g) =>
        g.id === activeGroup.id
          ? { ...g, chars: [...new Set([...g.chars, ...chars])] }
          : g
      )
    );
  }

  async function handleRemoveChar(groupId: number, char: string) {
    await apiPost({ action: "removeChar", groupId, char });
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, chars: g.chars.filter((c) => c !== char) } : g))
    );
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
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => withAuth(() => setCreateOpen(true))}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Tạo nhóm
        </Button>
      </div>

      {/* Groups */}
      {groups.length === 0 ? (
        <p className="text-center text-muted-foreground py-16">Chưa có nhóm nào. Nhấn &quot;Tạo nhóm&quot; để bắt đầu.</p>
      ) : (
        <div className="space-y-2">
          {groups.map((group) => {
            const isOpen = openGroups.has(group.id);
            return (
              <div key={group.id} className="rounded-lg border border-border overflow-hidden">
                <button
                  className="w-full flex items-center gap-2 px-4 py-3 bg-muted/50 hover:bg-muted transition-colors text-left"
                  onClick={() => toggleGroup(group.id)}
                >
                  {isOpen ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                  <span className="font-medium text-sm" style={{ fontFamily: "'Noto Serif SC', serif" }}>{group.name}</span>
                  <span className="text-xs text-muted-foreground ml-1">({group.chars.length})</span>
                  <div className="ml-auto flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors text-xs flex items-center gap-1"
                      onClick={() => withAuth(() => { setActiveGroup(group); setAddOpen(true); })}
                    >
                      <Plus className="w-3.5 h-3.5" /> Thêm từ
                    </button>
                    <button
                      className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => withAuth(() => setEditingGroup(group))}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      onClick={() => withAuth(() => handleDeleteGroup(group.id))}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </button>
                {isOpen && (
                  <div className="p-3">
                    {group.chars.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">Chưa có từ nào. Nhấn &quot;Thêm từ&quot; để thêm.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {group.chars.map((ch) => (
                          <CharMiniCard
                            key={ch}
                            char={ch}
                            userEdits={userEdits}
                            onRemove={() => withAuth(() => handleRemoveChar(group.id, ch))}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <CreateGroupDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={handleCreateGroup}
      />
      <CreateGroupDialog
        open={editingGroup !== null}
        initial={editingGroup?.name}
        onClose={() => setEditingGroup(null)}
        onSave={handleRenameGroup}
      />
      <AddCharsDialog
        open={addOpen}
        group={activeGroup}
        onClose={() => setAddOpen(false)}
        onAdd={handleAddChars}
      />
      {auth.status === "prompting" && <KeyPromptModal onSubmit={submitKey} onDismiss={dismiss} />}
    </div>
  );
}
