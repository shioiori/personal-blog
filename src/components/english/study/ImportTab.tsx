"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Upload, X, Check } from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import { cn } from "@/src/utils/ui";
import { useEnglishStudy } from "@/src/context/english";
import type { ImportWordInput } from "@/src/declaration/english";

interface PreviewEntry {
  word: string;
  senses: { partOfSpeech: string; cambridgeMeaning: string; meaningVi: string }[];
}

type Stage = "idle" | "parsing" | "preview" | "done";

function parseWorkbook(buf: ArrayBuffer): PreviewEntry[] {
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false });

  // Row 1 blank, row 2 title, data from row 3 (index 2).
  const dataRows = rows.slice(2);
  const byWord = new Map<string, PreviewEntry>();

  for (const row of dataRows) {
    const wordRaw = (row?.[0] as string | undefined)?.toString().trim();
    const pos = (row?.[1] as string | undefined)?.toString().trim() ?? "";
    const meaning = (row?.[2] as string | undefined)?.toString().trim() ?? "";
    if (!wordRaw) continue;

    const key = wordRaw.toLowerCase();
    if (!byWord.has(key)) byWord.set(key, { word: wordRaw, senses: [] });
    byWord.get(key)!.senses.push({ partOfSpeech: pos, cambridgeMeaning: meaning, meaningVi: "" });
  }

  return [...byWord.values()];
}

export function ImportTab() {
  const { groups, refetchAll } = useEnglishStudy();
  const [stage, setStage] = useState<Stage>("idle");
  const [entries, setEntries] = useState<PreviewEntry[]>([]);
  const [translating, setTranslating] = useState(false);
  const [groupChoice, setGroupChoice] = useState<string>("");
  const [newGroupName, setNewGroupName] = useState("");
  const [saving, setSaving] = useState(false);
  const [doneStats, setDoneStats] = useState<{ created: number; skipped: string[] }>({ created: 0, skipped: [] });
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setStage("parsing");
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseWorkbook(buf);
      setEntries(parsed);
      setStage("preview");

      // Best-effort auto-translate every sense's meaning. Never blocks the flow.
      setTranslating(true);
      const jobs: { word: string; senseIndex: number; text: string }[] = [];
      parsed.forEach((entry) => {
        entry.senses.forEach((s, i) => {
          if (s.cambridgeMeaning) jobs.push({ word: entry.word, senseIndex: i, text: s.cambridgeMeaning });
        });
      });

      const BATCH = 6;
      for (let i = 0; i < jobs.length; i += BATCH) {
        const batch = jobs.slice(i, i + BATCH);
        await Promise.all(
          batch.map(async (job) => {
            try {
              const res = await fetch("/api/english/translate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: job.text }),
              });
              const data = (await res.json()) as { translation: string | null };
              if (data.translation) {
                setEntries((prev) =>
                  prev.map((e) =>
                    e.word === job.word
                      ? { ...e, senses: e.senses.map((s, i) => (i === job.senseIndex ? { ...s, meaningVi: data.translation! } : s)) }
                      : e
                  )
                );
              }
            } catch {
              // best-effort, ignore
            }
          })
        );
      }
      setTranslating(false);
    } catch (e) {
      console.error(e);
      setStage("idle");
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  function updateEntrySenseVi(wi: number, si: number, value: string) {
    setEntries((prev) =>
      prev.map((e, i) => (i === wi ? { ...e, senses: e.senses.map((s, j) => (j === si ? { ...s, meaningVi: value } : s)) } : e))
    );
  }

  async function handleConfirm() {
    if (entries.length === 0) return;
    setSaving(true);
    try {
      const items: ImportWordInput[] = entries.map((e) => ({
        word: e.word,
        senses: e.senses.map((s) => ({
          partOfSpeech: s.partOfSpeech || undefined,
          cambridgeMeaning: s.cambridgeMeaning || undefined,
          meaningVi: s.meaningVi || undefined,
        })),
      }));

      const body: { items: ImportWordInput[]; groupId?: number; newGroupName?: string } = { items };
      if (groupChoice === "__new__") {
        if (newGroupName.trim()) body.newGroupName = newGroupName.trim();
      } else if (groupChoice) {
        body.groupId = parseInt(groupChoice, 10);
      }

      const res = await fetch("/api/english/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { created: number; skippedWords: string[] };
      setDoneStats({ created: data.created, skipped: data.skippedWords });
      await refetchAll();
      setStage("done");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setEntries([]);
    setGroupChoice("");
    setNewGroupName("");
    setStage("idle");
  }

  if (stage === "done") {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-green-500/15 flex items-center justify-center">
          <Check className="w-6 h-6 text-green-500" />
        </div>
        <p className="text-sm text-muted-foreground">
          Đã thêm <span className="font-medium text-foreground">{doneStats.created}</span> từ mới.
          {doneStats.skipped.length > 0 && (
            <> Bỏ qua {doneStats.skipped.length} từ đã có: {doneStats.skipped.slice(0, 10).join(", ")}{doneStats.skipped.length > 10 ? "..." : ""}</>
          )}
        </p>
        <button onClick={handleCancel} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors">
          Import thêm
        </button>
      </div>
    );
  }

  if (stage === "preview") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Tìm thấy <span className="font-medium text-foreground">{entries.length}</span> từ
            {translating && <span className="ml-2 text-xs italic">(đang dịch tự động...)</span>}
          </p>
          <button onClick={handleCancel} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={groupChoice}
            onChange={(e) => setGroupChoice(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Không vào nhóm</option>
            {groups.map((g) => (
              <option key={g.id} value={String(g.id)}>{g.name}</option>
            ))}
            <option value="__new__">+ Tạo nhóm mới...</option>
          </select>
          {groupChoice === "__new__" && (
            <Input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Tên nhóm mới"
              className="w-56"
            />
          )}
        </div>

        <div className="max-h-96 overflow-y-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Từ</th>
                <th className="text-left px-3 py-2 font-medium">Loại từ</th>
                <th className="text-left px-3 py-2 font-medium">Nghĩa Cambridge</th>
                <th className="text-left px-3 py-2 font-medium">Nghĩa tiếng Việt</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, wi) =>
                e.senses.map((s, si) => (
                  <tr key={`${wi}-${si}`} className="border-t border-border">
                    {si === 0 && (
                      <td className="px-3 py-2 font-medium align-top" rowSpan={e.senses.length}>{e.word}</td>
                    )}
                    <td className="px-3 py-2 text-muted-foreground align-top">{s.partOfSpeech || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground align-top max-w-xs truncate">{s.cambridgeMeaning || "—"}</td>
                    <td className="px-3 py-2 align-top">
                      <input
                        value={s.meaningVi}
                        onChange={(ev) => updateEntrySenseVi(wi, si, ev.target.value)}
                        className="w-full rounded border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex gap-3">
          <Button onClick={handleConfirm} disabled={saving || entries.length === 0}>
            {saving ? "Đang lưu..." : "OK – Xác nhận import"}
          </Button>
          <Button variant="outline" onClick={handleCancel} disabled={saving}>Hủy</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Tải lên file <code className="text-xs bg-muted px-1 py-0.5 rounded">.xlsx</code> xuất từ Cambridge Dictionary.
        Các dòng cùng từ sẽ được gộp thành nhiều nghĩa của một từ.
      </p>

      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex flex-col items-center gap-3 py-14 rounded-xl border-2 border-dashed border-border",
          "cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors"
        )}
      >
        <Upload className="w-8 h-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {stage === "parsing" ? "Đang đọc file..." : (
            <>Kéo thả file vào đây hoặc <span className="text-primary underline underline-offset-2">chọn file</span></>
          )}
        </p>
        <p className="text-xs text-muted-foreground/60">.xlsx</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  );
}
