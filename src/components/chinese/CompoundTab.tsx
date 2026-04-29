"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { CHINESE_DATA } from "@/src/data/chinese";
import type { CompoundCategory, CompoundWord } from "@/src/declaration/chinese";
import { Button } from "@/src/components/ui/Button";
import { Checkbox } from "@/src/components/ui/Checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/src/components/ui/Dialog";
import { cn } from "@/src/utils/ui";
import { Search, ChevronDown, ChevronRight, Plus, Pencil, Trash2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/src/components/ui/Tooltip";
import { CharTooltip } from "./CharTooltip";
import { TooltipMode } from "@/src/components/enums";
import type { UserEdits } from "@/src/declaration/chinese";
import { useEditAuth } from "./useEditAuth";
import { KeyPromptModal } from "./KeyPromptModal";

const CAT_COLORS = [
  "#3b82f6", "#22c55e", "#f59e0b", "#ec4899", "#8b5cf6",
  "#06b6d4", "#f97316", "#10b981", "#6366f1", "#ef4444",
];

// ── Mapping helpers ──────────────────────────────────────────────────────────

function mapPinyin(word: string): string {
  return [...word].map((ch) => CHINESE_DATA[ch]?.pinyin ?? "").filter(Boolean).join(" ");
}

function mapHanViet(word: string): string {
  return [...word].map((ch) => CHINESE_DATA[ch]?.hanViet ?? "").filter(Boolean).join(" ");
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`GET ${path} failed`);
  return res.json() as Promise<T>;
}

async function apiMutate(path: string, method: string, body: unknown): Promise<Response> {
  return fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Word form dialog ──────────────────────────────────────────────────────────

interface WordFormProps {
  open: boolean;
  initial?: CompoundWord;
  categories: CompoundCategory[];
  onClose: () => void;
  onSave: (data: Omit<CompoundWord, "id">) => void;
}

function WordFormDialog({ open, initial, categories, onClose, onSave }: WordFormProps) {
  const [word, setWord] = useState(initial?.word ?? "");
  const [meaning, setMeaning] = useState(initial?.meaning ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [selectedCats, setSelectedCats] = useState<Set<number>>(new Set(initial?.categoryIds ?? []));
  const [initialWord, setInitialWord] = useState(initial?.word ?? "");

  useEffect(() => {
    setWord(initial?.word ?? "");
    setMeaning(initial?.meaning ?? "");
    setNote(initial?.note ?? "");
    setSelectedCats(new Set(initial?.categoryIds ?? []));
    setInitialWord(initial?.word ?? "");
  }, [initial, open]);

  // Only auto-map when word changes from its initial value (i.e. user edits the characters)
  const pinyin = useMemo(
    () => (word !== initialWord ? mapPinyin(word) : (initial?.pinyin ?? mapPinyin(word))),
    [word, initialWord, initial?.pinyin]
  );
  const hanViet = useMemo(
    () => (word !== initialWord ? mapHanViet(word) : (initial?.hanViet ?? mapHanViet(word))),
    [word, initialWord, initial?.hanViet]
  );

  function toggleCat(id: number) {
    setSelectedCats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSave() {
    if (!word.trim()) return;
    onSave({ word: word.trim(), meaning: meaning.trim(), pinyin, hanViet, note: note.trim(), categoryIds: [...selectedCats] });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{initial ? "Sửa từ ghép" : "Thêm từ ghép"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <FormField label="Từ ghép">
            <input
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder="Nhập chữ Hán..."
              style={word ? { fontFamily: "'Noto Serif SC', serif" } : undefined}
              className={inputCls}
            />
          </FormField>
          {word && (
            <div className="text-xs text-muted-foreground space-y-0.5 pl-1">
              <div>Pinyin: <span className="text-foreground">{pinyin || "—"}</span></div>
              <div>Hán Việt: <span className="text-foreground">{hanViet || "—"}</span></div>
            </div>
          )}
          <FormField label="Nghĩa">
            <textarea
              value={meaning}
              onChange={(e) => setMeaning(e.target.value)}
              rows={3}
              className={cn(inputCls, "resize-none")}
            />
          </FormField>
          <FormField label="Ghi chú">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={6}
              className={cn(inputCls, "resize-none")}
            />
          </FormField>
          <FormField label="Category">
            {categories.length === 0 ? (
              <p className="text-xs text-muted-foreground">Chưa có category nào.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <label key={cat.id} className="flex items-center gap-1.5 cursor-pointer text-sm">
                    <Checkbox
                      checked={selectedCats.has(cat.id)}
                      onCheckedChange={() => toggleCat(cat.id)}
                    />
                    {cat.name}
                  </label>
                ))}
              </div>
            )}
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Huỷ</Button>
          <Button onClick={handleSave} disabled={!word.trim()}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Category form dialog ──────────────────────────────────────────────────────

interface CatFormProps {
  open: boolean;
  initial?: CompoundCategory;
  onClose: () => void;
  onSave: (name: string) => void;
}

function CatFormDialog({ open, initial, onClose, onSave }: CatFormProps) {
  const [name, setName] = useState(initial?.name ?? "");

  useEffect(() => { setName(initial?.name ?? ""); }, [initial, open]);

  function handleSave() {
    if (!name.trim()) return;
    onSave(name.trim());
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>{initial ? "Sửa category" : "Thêm category"}</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <FormField label="Tên category">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="Nhập tên..."
              className={inputCls}
              autoFocus
            />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Huỷ</Button>
          <Button onClick={handleSave} disabled={!name.trim()}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Word card ─────────────────────────────────────────────────────────────────

interface WordCardProps {
  word: CompoundWord;
  userEdits: Record<string, UserEdits>;
  tooltipMode: TooltipMode;
  hidePinyin: boolean;
  hideMeaning: boolean;
  hideHanViet: boolean;
  hideNote: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function isChinese(ch: string) {
  const code = ch.codePointAt(0) ?? 0;
  return (code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf);
}

function WordCard({ word, userEdits, tooltipMode, hidePinyin, hideMeaning, hideHanViet, hideNote, onEdit, onDelete }: WordCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 flex flex-col gap-1 group relative">
      <div className="text-2xl font-medium leading-tight">
        {[...word.word].map((ch, i) => {
          const info = isChinese(ch) ? CHINESE_DATA[ch] : undefined;
          if (info && tooltipMode !== TooltipMode.Off) {
            return (
              <CharTooltip key={i} char={ch} info={info} edits={userEdits[ch] ?? {}} mode={tooltipMode} />
            );
          }
          return (
            <span key={i} style={{ fontFamily: "var(--font-noto-serif-sc), serif" }}>{ch}</span>
          );
        })}
      </div>
      {!hidePinyin && word.pinyin && (
        <div className="text-xs text-muted-foreground">{word.pinyin}</div>
      )}
      {!hideHanViet && word.hanViet && (
        <div className="text-xs text-blue-500 dark:text-blue-400">{word.hanViet}</div>
      )}
      {!hideMeaning && word.meaning && (
        <div className="text-sm text-foreground/80 whitespace-pre-wrap">{word.meaning}</div>
      )}
      {!hideNote && word.note && (
        <div className="text-xs text-muted-foreground italic whitespace-pre-wrap">{word.note}</div>
      )}
      <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <Pencil className="w-3 h-3" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CompoundTab() {
  const [categories, setCategories] = useState<CompoundCategory[]>([]);
  const [words, setWords] = useState<CompoundWord[]>([]);
  const [userEdits, setUserEdits] = useState<Record<string, UserEdits>>({});
  const [loaded, setLoaded] = useState(false);

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<Set<number>>(new Set());
  const [hidePinyin, setHidePinyin] = useState(false);
  const [hideMeaning, setHideMeaning] = useState(false);
  const [hideHanViet, setHideHanViet] = useState(false);
  const [hideNote, setHideNote] = useState(false);

  const [openGroups, setOpenGroups] = useState<Set<number | "uncategorized">>(new Set());

  // Word form state
  const [wordFormOpen, setWordFormOpen] = useState(false);
  const [editingWord, setEditingWord] = useState<CompoundWord | undefined>();

  // Category form state
  const [catFormOpen, setCatFormOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<CompoundCategory | undefined>();

  const { auth, requestEdit, submitKey, dismiss } = useEditAuth();
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (auth.status === "verified" && pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  }, [auth.status, pendingAction]);

  function withAuth(action: () => void) {
    if (requestEdit()) {
      action();
    } else {
      setPendingAction(() => action);
    }
  }

  // Load data
  useEffect(() => {
    Promise.all([
      apiFetch<CompoundCategory[]>("/api/chinese/compound-categories"),
      apiFetch<CompoundWord[]>("/api/chinese/compound-words"),
      apiFetch<Record<string, UserEdits>>("/api/chinese/edits"),
    ])
      .then(([cats, ws, edits]) => {
        setCategories(cats);
        setWords(ws);
        setUserEdits(edits);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Filtered words
  const filteredWords = useMemo(() => {
    let list = words;
    if (catFilter.size > 0) {
      list = list.filter((w) => w.categoryIds.some((cid) => catFilter.has(cid)));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (w) =>
          w.word.includes(q) ||
          w.pinyin.toLowerCase().includes(q) ||
          w.hanViet.toLowerCase().includes(q) ||
          w.meaning.toLowerCase().includes(q)
      );
    }
    return list;
  }, [words, search, catFilter]);

  // Group by category
  const grouped = useMemo(() => {
    const catMap = new Map<number, CompoundWord[]>();
    const uncategorized: CompoundWord[] = [];
    for (const w of filteredWords) {
      if (w.categoryIds.length === 0) {
        uncategorized.push(w);
      } else {
        for (const cid of w.categoryIds) {
          if (!catMap.has(cid)) catMap.set(cid, []);
          catMap.get(cid)!.push(w);
        }
      }
    }
    const result: { key: number | "uncategorized"; label: string; words: CompoundWord[] }[] = [];
    for (const cat of categories) {
      const ws = catMap.get(cat.id);
      if (ws && ws.length > 0) result.push({ key: cat.id, label: cat.name, words: ws });
    }
    if (uncategorized.length > 0) result.push({ key: "uncategorized", label: "Chưa phân loại", words: uncategorized });
    return result;
  }, [filteredWords, categories]);

  const toggleGroup = useCallback((key: number | "uncategorized") => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleCatFilter = useCallback((id: number) => {
    setCatFilter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // CRUD: words
  async function handleSaveWord(data: Omit<CompoundWord, "id">) {
    if (editingWord) {
      await apiMutate("/api/chinese/compound-words", "PUT", { id: editingWord.id, ...data });
      setWords((prev) => prev.map((w) => (w.id === editingWord.id ? { id: editingWord.id, ...data } : w)));
    } else {
      const res = await apiMutate("/api/chinese/compound-words", "POST", data);
      const created = (await res.json()) as CompoundWord;
      setWords((prev) => [...prev, created]);
    }
  }

  async function handleDeleteWord(id: number) {
    await apiMutate("/api/chinese/compound-words", "DELETE", { id });
    setWords((prev) => prev.filter((w) => w.id !== id));
  }

  // CRUD: categories
  async function handleSaveCat(name: string) {
    if (editingCat) {
      await apiMutate("/api/chinese/compound-categories", "PUT", { id: editingCat.id, name });
      setCategories((prev) => prev.map((c) => (c.id === editingCat.id ? { id: editingCat.id, name } : c)));
    } else {
      const res = await apiMutate("/api/chinese/compound-categories", "POST", { name });
      const created = (await res.json()) as CompoundCategory;
      setCategories((prev) => [...prev, created]);
    }
  }

  async function handleDeleteCat(id: number) {
    await apiMutate("/api/chinese/compound-categories", "DELETE", { id });
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setWords((prev) => prev.map((w) => ({ ...w, categoryIds: w.categoryIds.filter((cid) => cid !== id) })));
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
      {/* Toolbar row */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-2 items-center flex-1 min-w-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm từ..."
              className={cn(
                "pl-10 pr-3 h-10 w-80 rounded-md border border-border bg-background text-sm",
                "focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
              )}
            />
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => withAuth(() => { setEditingCat(undefined); setCatFormOpen(true); })}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Category
        </Button>
        <Button size="sm" onClick={() => withAuth(() => { setEditingWord(undefined); setWordFormOpen(true); })}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Từ ghép
        </Button>
      </div>

      {/* Category filter pills */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          {categories.map((cat, idx) => {
            const color = CAT_COLORS[idx % CAT_COLORS.length];
            const active = catFilter.has(cat.id);
            return (
            <button
              key={cat.id}
              onClick={() => toggleCatFilter(cat.id)}
              className="px-3 py-1 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 hover:opacity-80"
              style={active
                ? { backgroundColor: color, borderColor: color, color: "#fff" }
                : { borderColor: color, color: color, backgroundColor: "transparent" }}
            >
              {cat.name}
              <span
                className="opacity-60 hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); withAuth(() => { setEditingCat(cat); setCatFormOpen(true); }); }}
              >
                <Pencil className="w-2.5 h-2.5" />
              </span>
              <span
                className="opacity-60 hover:opacity-100 hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); withAuth(() => handleDeleteCat(cat.id)); }}
              >
                <Trash2 className="w-2.5 h-2.5" />
              </span>
            </button>
          );})}
          {catFilter.size > 0 && (
            <button
              onClick={() => setCatFilter(new Set())}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Xóa lọc
            </button>
          )}
        </div>
      )}

      {/* Visibility checkboxes */}
      <div className="flex flex-wrap gap-4 items-center">
        <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground select-none">
          <Checkbox checked={hidePinyin} onCheckedChange={(v) => setHidePinyin(Boolean(v))} />
          Ẩn pinyin
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground select-none">
          <Checkbox checked={hideHanViet} onCheckedChange={(v) => setHideHanViet(Boolean(v))} />
          Ẩn hán việt
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground select-none">
          <Checkbox checked={hideMeaning} onCheckedChange={(v) => setHideMeaning(Boolean(v))} />
          Ẩn nghĩa
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground select-none">
          <Checkbox checked={hideNote} onCheckedChange={(v) => setHideNote(Boolean(v))} />
          Ẩn ghi chú
        </label>
      </div>

      {/* Grouped word list */}
      {grouped.length === 0 ? (
        <p className="text-center text-muted-foreground py-16">
          {words.length === 0 ? "Chưa có từ ghép nào. Nhấn \"+ Từ ghép\" để thêm." : "Không tìm thấy từ nào phù hợp."}
        </p>
      ) : (
        <div className="space-y-2">
          {grouped.map((group) => {
            const isOpen = openGroups.has(group.key);
            return (
              <div key={group.key} className="rounded-lg border border-border overflow-hidden">
                <button
                  className="w-full flex items-center gap-2 px-4 py-3 bg-muted/50 hover:bg-muted transition-colors text-left"
                  onClick={() => toggleGroup(group.key)}
                >
                  {isOpen ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                  <span className="font-medium text-sm">{group.label}</span>
                  <span className="text-xs text-muted-foreground ml-1">({group.words.length})</span>
                </button>
                {isOpen && (
                  <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                    {group.words.map((w) => (
                      <WordCard
                        key={w.id}
                        word={w}
                        userEdits={userEdits}
                        tooltipMode={TooltipMode.Full}
                        hidePinyin={hidePinyin}
                        hideMeaning={hideMeaning}
                        hideHanViet={hideHanViet}
                        hideNote={hideNote}
                        onEdit={() => withAuth(() => { setEditingWord(w); setWordFormOpen(true); })}
                        onDelete={() => withAuth(() => handleDeleteWord(w.id))}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      <WordFormDialog
        open={wordFormOpen}
        initial={editingWord}
        categories={categories}
        onClose={() => setWordFormOpen(false)}
        onSave={handleSaveWord}
      />
      <CatFormDialog
        open={catFormOpen}
        initial={editingCat}
        onClose={() => setCatFormOpen(false)}
        onSave={handleSaveCat}
      />
      {auth.status === "prompting" && (
        <KeyPromptModal onSubmit={submitKey} onDismiss={dismiss} />
      )}
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}
