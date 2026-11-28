"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Plus, FileText, Trash2, Pencil, Check, CheckCircle2, Shuffle, X, Link2 } from "lucide-react";
import type { Essay, EssayCategoryGroups, EssayDraft, EssaySummary } from "@/src/declaration/english";
import { Button } from "@/src/components/ui/Button";
import { Textarea } from "@/src/components/ui/Textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/src/components/ui/Dialog";
import { EssayEditor } from "./EssayEditor";
import { usePagedList } from "../shared/usePagedList";
import { Pagination } from "../shared/Pagination";
import { cn } from "@/src/utils/ui";
import { useEnglishStudy } from "@/src/context/english";
import { ESSAY_CATEGORIES, essayCategoryLabel, normalizeEssayCategories, type EssayCategory } from "@/src/lib/essay-categories";

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`GET ${path} failed`);
  return res.json() as Promise<T>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function chipClass(on: boolean) {
  return cn(
    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
    on ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-accent",
  );
}

function CategoryGroupsDialog({
  open,
  onOpenChange,
  initialCategory,
  value,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCategory: EssayCategory;
  value: EssayCategoryGroups;
  onChange: (category: EssayCategory, groupIds: number[]) => void;
}) {
  const { groups } = useEnglishStudy();
  const [category, setCategory] = useState(initialCategory);

  useEffect(() => {
    if (open) setCategory(initialCategory);
  }, [open, initialCategory]);

  const attached = value[category] ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gắn word group vào chủ đề</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
            {ESSAY_CATEGORIES.map((c) => {
              const count = value[c.id]?.length ?? 0;
              return (
                <button key={c.id} type="button" onClick={() => setCategory(c.id)} className={chipClass(c.id === category)}>
                  {c.label}
                  {count > 0 && <span className="opacity-70">{count}</span>}
                </button>
              );
            })}
          </div>
          <div className="space-y-2 border-t border-border pt-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Word group của {essayCategoryLabel(category)}
            </span>
            {groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có word group nào.</p>
            ) : (
              <div className="flex max-h-64 flex-wrap gap-1.5 overflow-y-auto">
                {groups.map((g) => {
                  const on = attached.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      aria-pressed={on}
                      title={g.name}
                      onClick={() => onChange(category, on ? attached.filter((id) => id !== g.id) : [...attached, g.id])}
                      className={cn(chipClass(on), "max-w-full")}
                    >
                      {on && <Check className="h-3 w-3 shrink-0" />}
                      <span className="truncate">{g.name}</span>
                      <span className="shrink-0 opacity-70">{g.wordIds.length}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function EssayTab() {
  const [essays, setEssays] = useState<EssaySummary[]>([]);
  const [essay, setEssay] = useState<Essay | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<number | null>(null);
  const [creatingDraft, setCreatingDraft] = useState(false);
  // "all" = no filter, "none" = essays without a category, "done" = essays marked as done.
  const [filter, setFilter] = useState<EssayCategory | "all" | "none" | "done">("all");
  const [categoryGroups, setCategoryGroups] = useState<EssayCategoryGroups>({});
  const [groupsDialogOpen, setGroupsDialogOpen] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [editingTitle, essay?.title]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftSave = useRef<{ timer: ReturnType<typeof setTimeout>; send: () => void; draftId: number } | null>(null);

  const refetchList = useCallback(async () => {
    setEssays(await apiGet<EssaySummary[]>("/api/english/essay"));
  }, []);

  useEffect(() => {
    refetchList()
      .catch(() => {})
      .finally(() => setLoaded(true));
    apiGet<EssayCategoryGroups>("/api/english/essay/category-groups")
      .then(setCategoryGroups)
      .catch(() => {});
  }, [refetchList]);

  async function updateCategoryGroups(category: EssayCategory, groupIds: number[]) {
    setCategoryGroups((prev) => ({ ...prev, [category]: groupIds }));
    const res = await fetch("/api/english/essay/category-groups", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, groupIds }),
    }).catch(() => null);
    if (res?.ok) {
      const saved = (await res.json()) as { groupIds: number[] };
      setCategoryGroups((prev) => ({ ...prev, [category]: saved.groupIds }));
    }
  }

  function showEssay(data: Essay) {
    setEssay(data);
    setActiveDraftId(data.drafts.at(-1)?.id ?? null);
    setEditingTitle(!data.title.trim());
  }

  async function createNewEssay() {
    const res = await fetch("/api/english/essay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "" }),
    });
    const created = (await res.json()) as Essay;
    setEssays((prev) => [{ id: created.id, title: created.title, categories: created.categories, done: created.done, createdAt: created.createdAt, updatedAt: created.updatedAt }, ...prev]);
    showEssay(created);
  }

  async function openEssay(id: number) {
    showEssay(await apiGet<Essay>(`/api/english/essay/${id}`));
  }

  async function deleteEssayById(id: number) {
    await fetch(`/api/english/essay/${id}`, { method: "DELETE" });
    setEssays((prev) => prev.filter((e) => e.id !== id));
    if (essay?.id === id) setEssay(null);
  }

  function scheduleSave(next: Essay) {
    setEssay(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch(`/api/english/essay/${next.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next.title, categories: next.categories, done: next.done }),
      }).catch(() => {});
    }, 800);
  }

  function flushDraftSave() {
    const pending = draftSave.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pending.send();
  }

  function updateDraftText(draftId: number, text: string) {
    if (!essay) return;
    if (draftSave.current?.draftId !== draftId) flushDraftSave();
    else clearTimeout(draftSave.current.timer);
    const essayId = essay.id;
    const send = () => {
      draftSave.current = null;
      fetch(`/api/english/essay/${essayId}/drafts/${draftId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      }).catch(() => {});
    };
    draftSave.current = { timer: setTimeout(send, 800), send, draftId };
    setEssay((prev) => prev && { ...prev, drafts: prev.drafts.map((d) => (d.id === draftId ? { ...d, text } : d)) });
  }

  async function createDraft() {
    if (!essay || creatingDraft) return;
    flushDraftSave();
    setCreatingDraft(true);
    try {
      const res = await fetch(`/api/english/essay/${essay.id}/drafts`, { method: "POST" });
      if (!res.ok) return;
      const draft = (await res.json()) as EssayDraft;
      setEssay((prev) => prev && { ...prev, drafts: [...prev.drafts, draft] });
      setActiveDraftId(draft.id);
    } finally {
      setCreatingDraft(false);
    }
  }

  async function deleteDraft(draftId: number) {
    if (!essay || essay.drafts.length <= 1) return;
    if (draftSave.current?.draftId === draftId) {
      clearTimeout(draftSave.current.timer);
      draftSave.current = null;
    }
    const res = await fetch(`/api/english/essay/${essay.id}/drafts/${draftId}`, { method: "DELETE" });
    if (!res.ok) return;
    const drafts = essay.drafts.filter((d) => d.id !== draftId);
    setEssay({ ...essay, drafts });
    if (activeDraftId === draftId) setActiveDraftId(drafts.at(-1)?.id ?? null);
  }

  function updateTitle(title: string) {
    if (!essay) return;
    scheduleSave({ ...essay, title });
    setEssays((prev) => prev.map((e) => (e.id === essay.id ? { ...e, title } : e)));
  }

  function toggleCategory(id: EssayCategory) {
    if (!essay) return;
    const has = essay.categories.includes(id);
    const categories = normalizeEssayCategories(has ? essay.categories.filter((c) => c !== id) : [...essay.categories, id]);
    scheduleSave({ ...essay, categories });
    setEssays((prev) => prev.map((e) => (e.id === essay.id ? { ...e, categories } : e)));
  }

  function toggleDone() {
    if (!essay) return;
    const done = !essay.done;
    scheduleSave({ ...essay, done });
    setEssays((prev) => prev.map((e) => (e.id === essay.id ? { ...e, done } : e)));
  }

  const activeDraft = essay?.drafts.find((d) => d.id === activeDraftId) ?? essay?.drafts.at(-1);
  const filtered =
    filter === "all"
      ? essays
      : filter === "done"
        ? essays.filter((e) => e.done)
        : filter === "none"
          ? essays.filter((e) => e.categories.length === 0)
          : essays.filter((e) => e.categories.includes(filter));
  const { visible, page, pageCount, goTo, listRef } = usePagedList(filtered, filter, 15);

  if (!loaded) return <p className="text-sm text-muted-foreground">Đang tải...</p>;

  if (!essay) {
    const counts = new Map<string, number>();
    for (const e of essays) {
      for (const k of e.categories.length ? e.categories : ["none"]) counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const uncategorized = counts.get("none") ?? 0;
    const doneCount = essays.filter((e) => e.done).length;
    const randomPool = filtered.filter((e) => !e.done && e.title.trim());
    const chips: { id: EssayCategory | "all" | "none" | "done"; label: string; count: number }[] = [
      { id: "all", label: "Tất cả", count: essays.length },
      ...(doneCount > 0 ? [{ id: "done" as const, label: "Hoàn thành", count: doneCount }] : []),
      ...ESSAY_CATEGORIES.filter((c) => counts.has(c.id)).map((c) => ({ id: c.id, label: c.label, count: counts.get(c.id)! })),
      ...(uncategorized > 0 && uncategorized < essays.length ? [{ id: "none" as const, label: "Chưa phân loại", count: uncategorized }] : []),
    ];
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button onClick={createNewEssay} className="gap-1.5">
            <Plus className="h-4 w-4" /> Bài luận mới
          </Button>
          <Button
            variant="outline"
            onClick={() => openEssay(randomPool[Math.floor(Math.random() * randomPool.length)].id)}
            disabled={randomPool.length === 0}
            className="gap-1.5"
          >
            <Shuffle className="h-4 w-4" /> Đề ngẫu nhiên
          </Button>
        </div>
        {essays.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có bài luận nào.</p>
        ) : (
          <div ref={listRef} className="scroll-mt-24 space-y-2">
            {chips.length > 1 && (
              <div className="flex flex-wrap gap-1.5 pb-1">
                {chips.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setFilter(c.id)}
                    className={chipClass(filter === c.id)}
                  >
                    {c.label} <span className="opacity-70">{c.count}</span>
                  </button>
                ))}
              </div>
            )}
            {filtered.length === 0 && <p className="text-sm text-muted-foreground">Không có bài luận nào trong mục này.</p>}
            {visible.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 hover:bg-accent/40 cursor-pointer transition-colors"
                onClick={() => openEssay(e.id)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {e.done ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                  ) : (
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="line-clamp-2 text-sm font-medium" title={e.title}>{e.title || "Bài luận chưa đặt tên"}</span>
                </div>
                {e.categories.length > 0 && (
                  <div className="ml-auto flex max-w-[50%] shrink-0 flex-wrap justify-end gap-1">
                    {e.categories.map((id) => (
                      <span key={id} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {essayCategoryLabel(id)}
                      </span>
                    ))}
                  </div>
                )}
                <button
                  onClick={(ev) => {
                    ev.stopPropagation();
                    deleteEssayById(e.id);
                  }}
                  className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Pagination page={page} pageCount={pageCount} onChange={goTo} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Đề bài</span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={essay.done ? "default" : "outline"}
              onClick={toggleDone}
              className={cn("gap-1.5", essay.done && "bg-green-600 hover:bg-green-700 text-white")}
            >
              {essay.done ? <CheckCircle2 className="h-4 w-4" /> : <Check className="h-4 w-4" />}
              {essay.done ? "Đã hoàn thành" : "Đánh dấu hoàn thành"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => { flushDraftSave(); setEssay(null); }}>
              ← Danh sách
            </Button>
          </div>
        </div>
        {editingTitle ? (
          <div className="flex items-start gap-2">
            <Textarea
              ref={titleRef}
              autoFocus
              onFocus={(e) => {
                const len = e.currentTarget.value.length;
                e.currentTarget.setSelectionRange(len, len);
              }}
              value={essay.title}
              onChange={(e) => updateTitle(e.target.value)}
              onKeyDown={(e) => {
                if ((e.key === "Enter" && !e.shiftKey) || e.key === "Escape") {
                  e.preventDefault();
                  setEditingTitle(false);
                }
              }}
              onBlur={() => setEditingTitle(false)}
              placeholder="Nhập đề bài / tên bài luận..."
              rows={2}
              className="min-h-0 resize-none whitespace-pre-wrap break-words text-base md:text-base font-medium leading-relaxed"
            />
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setEditingTitle(false)}
              title="Xong"
              className="mt-2 shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <Check className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <p
              className={cn(
                "whitespace-pre-wrap break-words text-base font-medium leading-relaxed",
                !essay.title.trim() && "italic text-muted-foreground",
              )}
            >
              {essay.title.trim() || "Chưa có đề bài"}
            </p>
            <button
              type="button"
              onClick={() => setEditingTitle(true)}
              title="Sửa đề bài"
              className="mt-0.5 shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Chủ đề (chọn nhiều)</span>
          <Button variant="outline" size="sm" onClick={() => setGroupsDialogOpen(true)} className="gap-1.5">
            <Link2 className="h-3.5 w-3.5" /> Gắn word group
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ESSAY_CATEGORIES.map((c) => {
            const on = essay.categories.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleCategory(c.id)}
                className={chipClass(on)}
              >
                {on && <Check className="h-3 w-3" />}
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-1 border-b border-border">
        {essay.drafts.map((d, i) => {
          const active = d.id === activeDraft?.id;
          return (
            <div
              key={d.id}
              className={cn(
                "group flex items-center gap-1 border-b-2 -mb-px transition-colors",
                active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <button onClick={() => setActiveDraftId(d.id)} className="pl-3 py-2 text-sm font-medium">
                Bài {i + 1} <span className="font-normal opacity-70">· {formatDate(d.createdAt)}</span>
              </button>
              {essay.drafts.length > 1 ? (
                <button
                  onClick={() => deleteDraft(d.id)}
                  title="Xoá bài này"
                  className="mr-1 rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : (
                <span className="w-2" />
              )}
            </div>
          );
        })}
        <button
          onClick={createDraft}
          disabled={creatingDraft}
          className="flex items-center gap-1 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          <Plus className="h-4 w-4" /> {creatingDraft ? "Đang tạo..." : "Bài mới"}
        </button>
      </div>

      {creatingDraft ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Đang tạo bài mới...</p>
      ) : activeDraft && (
        <EssayEditor
          key={activeDraft.id}
          text={activeDraft.text}
          onChange={(text) => updateDraftText(activeDraft.id, text)}
          highlightCategories={essay.categories.filter((c) => categoryGroups[c]?.length)}
        />
      )}

      <CategoryGroupsDialog
        open={groupsDialogOpen}
        onOpenChange={setGroupsDialogOpen}
        initialCategory={essay.categories[0] ?? ESSAY_CATEGORIES[0].id}
        value={categoryGroups}
        onChange={updateCategoryGroups}
      />
    </div>
  );
}
