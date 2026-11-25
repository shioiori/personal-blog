"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Plus, FileText, Trash2, Pencil, Check, CheckCircle2, Shuffle } from "lucide-react";
import type { Essay, EssaySummary, EssayStep as EssayStepType, EssayPart } from "@/src/declaration/english";
import { Button } from "@/src/components/ui/Button";
import { Textarea } from "@/src/components/ui/Textarea";
import { OutlineStep } from "./OutlineStep";
import { TranslateStep } from "./TranslateStep";
import { EditStep } from "./EditStep";
import { applyTextToParts, joinEssayText, validateEssayParts } from "@/src/lib/essay-format";
import { cn } from "@/src/utils/ui";
import { ESSAY_CATEGORIES, essayCategoryLabel, normalizeEssayCategories, type EssayCategory } from "@/src/lib/essay-categories";

const STEPS: { id: EssayStepType; label: string }[] = [
  { id: "outline", label: "1. Dàn ý" },
  { id: "translate", label: "2. Dịch" },
  { id: "edit", label: "3. Chỉnh sửa" },
];

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`GET ${path} failed`);
  return res.json() as Promise<T>;
}

export function EssayTab() {
  const [essays, setEssays] = useState<EssaySummary[]>([]);
  const [essay, setEssay] = useState<Essay | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  // "all" = no filter, "none" = essays without a category, "done" = essays marked as done.
  const [filter, setFilter] = useState<EssayCategory | "all" | "none" | "done">("all");
  const titleRef = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [editingTitle, essay?.title]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refetchList = useCallback(async () => {
    setEssays(await apiGet<EssaySummary[]>("/api/english/essay"));
  }, []);

  useEffect(() => {
    refetchList()
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [refetchList]);

  async function createNewEssay() {
    const res = await fetch("/api/english/essay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "" }),
    });
    const created = (await res.json()) as Essay;
    setEssays((prev) => [{ id: created.id, title: created.title, categories: created.categories, step: created.step, done: created.done, createdAt: created.createdAt, updatedAt: created.updatedAt }, ...prev]);
    setEssay(created);
    setEditingTitle(!created.title.trim());
  }

  async function openEssay(id: number) {
    const data = await apiGet<Essay>(`/api/english/essay/${id}`);
    setEssay(data);
    setEditingTitle(!data.title.trim());
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
        body: JSON.stringify({ title: next.title, categories: next.categories, parts: next.parts, step: next.step, finalText: next.finalText, done: next.done }),
      }).catch(() => {});
    }, 800);
  }

  function updateParts(parts: EssayPart[]) {
    if (!essay) return;
    scheduleSave({ ...essay, parts });
  }

  function updateFinalText(finalText: string) {
    if (!essay) return;
    // Step 3 is the source of truth once edited: write the change back into each step-2 translation.
    scheduleSave({ ...essay, finalText, parts: applyTextToParts(essay.parts, finalText) });
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

  function goToStep(step: EssayStepType) {
    if (!essay) return;
    let next = essay;
    if (step === "edit" && !essay.finalText.trim()) {
      next = { ...essay, finalText: joinEssayText(essay.parts) };
    }
    scheduleSave({ ...next, step });
  }

  const validationError = essay ? validateEssayParts(essay.parts) : null;

  if (!loaded) return <p className="text-sm text-muted-foreground">Đang tải...</p>;

  if (!essay) {
    const counts = new Map<string, number>();
    for (const e of essays) {
      for (const k of e.categories.length ? e.categories : ["none"]) counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const visible =
      filter === "all"
        ? essays
        : filter === "done"
          ? essays.filter((e) => e.done)
          : filter === "none"
            ? essays.filter((e) => e.categories.length === 0)
            : essays.filter((e) => e.categories.includes(filter));
    const uncategorized = counts.get("none") ?? 0;
    const doneCount = essays.filter((e) => e.done).length;
    const randomPool = visible.filter((e) => !e.done && e.title.trim());
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
          <div className="space-y-2">
            {chips.length > 1 && (
              <div className="flex flex-wrap gap-1.5 pb-1">
                {chips.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setFilter(c.id)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition-colors",
                      filter === c.id ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {c.label} <span className="opacity-70">{c.count}</span>
                  </button>
                ))}
              </div>
            )}
            {visible.length === 0 && <p className="text-sm text-muted-foreground">Không có bài luận nào trong mục này.</p>}
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
            <Button variant="outline" size="sm" onClick={() => setEssay(null)}>
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
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Chủ đề (chọn nhiều)</span>
        <div className="flex flex-wrap gap-1.5">
          {ESSAY_CATEGORIES.map((c) => {
            const on = essay.categories.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleCategory(c.id)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                  on ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-accent",
                )}
              >
                {on && <Check className="h-3 w-3" />}
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2 border-b border-border">
        {STEPS.map((s) => (
          <button
            key={s.id}
            onClick={() => goToStep(s.id)}
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
              essay.step === s.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {essay.step === "outline" && <OutlineStep parts={essay.parts} onChange={updateParts} />}
      {essay.step === "translate" && (
        <>
          {validationError && <p className="text-sm text-destructive">{validationError}</p>}
          <TranslateStep parts={essay.parts} onChange={updateParts} />
        </>
      )}
      {essay.step === "edit" && (
        <EditStep text={essay.finalText} joinedText={joinEssayText(essay.parts)} onChange={updateFinalText} />
      )}
    </div>
  );
}
