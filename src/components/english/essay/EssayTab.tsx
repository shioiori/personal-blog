"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, FileText, Trash2 } from "lucide-react";
import type { Essay, EssaySummary, EssayStep as EssayStepType, EssayPart } from "@/src/declaration/english";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import { OutlineStep } from "./OutlineStep";
import { TranslateStep } from "./TranslateStep";
import { EditStep } from "./EditStep";
import { joinEssayText, validateEssayParts } from "@/src/lib/essay-format";
import { cn } from "@/src/utils/ui";

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
    setEssays((prev) => [{ id: created.id, title: created.title, step: created.step, createdAt: created.createdAt, updatedAt: created.updatedAt }, ...prev]);
    setEssay(created);
  }

  async function openEssay(id: number) {
    const data = await apiGet<Essay>(`/api/english/essay/${id}`);
    setEssay(data);
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
        body: JSON.stringify({ title: next.title, parts: next.parts, step: next.step, finalText: next.finalText }),
      }).catch(() => {});
    }, 800);
  }

  function updateParts(parts: EssayPart[]) {
    if (!essay) return;
    scheduleSave({ ...essay, parts });
  }

  function updateFinalText(finalText: string) {
    if (!essay) return;
    scheduleSave({ ...essay, finalText });
  }

  function updateTitle(title: string) {
    if (!essay) return;
    scheduleSave({ ...essay, title });
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
    return (
      <div className="space-y-4">
        <Button onClick={createNewEssay} className="gap-1.5">
          <Plus className="h-4 w-4" /> Bài luận mới
        </Button>
        {essays.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có bài luận nào.</p>
        ) : (
          <div className="space-y-2">
            {essays.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 hover:bg-accent/40 cursor-pointer transition-colors"
                onClick={() => openEssay(e.id)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-medium">{e.title || "Bài luận chưa đặt tên"}</span>
                </div>
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
      <div className="flex items-center justify-between gap-2">
        <Input
          value={essay.title}
          onChange={(e) => updateTitle(e.target.value)}
          placeholder="Tên bài luận..."
          className="max-w-sm font-medium"
        />
        <Button variant="outline" size="sm" onClick={() => setEssay(null)}>
          ← Danh sách
        </Button>
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
