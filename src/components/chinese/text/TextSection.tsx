"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookmarkCheck, Eye, FileText, History, Pencil, Save, Send, Trash2, X } from "lucide-react";
import { getAllCharacters, type CharacterInfo } from "@/src/data/chinese";
import { TooltipMode } from "@/src/components/enums";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/Tabs";
import { Textarea } from "@/src/components/ui/Textarea";
import { Input } from "@/src/components/ui/Input";
import { Checkbox } from "@/src/components/ui/Checkbox";
import { CharTooltip } from "../study/CharTooltip";
import type { UserEdits } from "../study/EditCardModal";
import { cn } from "@/src/utils/ui";
import { useLearnedChars } from "@/src/context/chinese";

interface SavedText {
  id: number;
  title?: string;
  text: string;
  createdAt: string;
}

function isChinese(ch: string) {
  const code = ch.codePointAt(0) ?? 0;
  return (code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf);
}

function collectChineseChars(...texts: Array<string | undefined>) {
  const chars = new Set<string>();
  for (const text of texts) {
    for (const ch of Array.from(text ?? "")) {
      if (isChinese(ch)) chars.add(ch);
    }
  }
  return Array.from(chars);
}

function ChineseTextDisplay({
  text,
  charMap,
  userEdits,
  showPinyin,
  enableTooltip,
  className,
}: {
  text: string;
  charMap: Map<string, CharacterInfo>;
  userEdits: Record<string, UserEdits>;
  showPinyin: boolean;
  enableTooltip: boolean;
  className?: string;
}) {
  return (
    <p
      className={cn("whitespace-pre-wrap break-words leading-relaxed", className)}
      style={{ fontFamily: "var(--font-noto-serif-sc), serif" }}
    >
      {Array.from(text).map((ch, i) => {
        const info = isChinese(ch) ? charMap.get(ch) : undefined;
        if (info) {
          const pinyin = userEdits[ch]?.pinyin || info.pinyin;
          return (
            <span
              key={`${ch}-${i}`}
              className={cn(
                "inline-flex flex-col items-center align-bottom",
                showPinyin ? "mx-1.5 min-w-8" : "mx-0.5"
              )}
            >
              {showPinyin && (
                <span className="h-4 whitespace-nowrap text-[0.58em] leading-none text-muted-foreground">
                  {pinyin}
                </span>
              )}
              {enableTooltip ? (
                <CharTooltip
                  char={ch}
                  info={info}
                  edits={userEdits[ch] ?? {}}
                  mode={TooltipMode.Full}
                />
              ) : (
                <span>{ch}</span>
              )}
            </span>
          );
        }
        if (showPinyin && ch !== "\n") {
          return (
            <span
              key={`${ch}-${i}`}
              className="inline-flex min-w-2 flex-col items-center align-bottom mx-0.5"
            >
              <span className="h-4 text-[0.58em] leading-none text-muted-foreground" />
              <span>{ch === " " ? "\u00a0" : ch}</span>
            </span>
          );
        }
        return <span key={`${ch}-${i}`}>{ch}</span>;
      })}
    </p>
  );
}

function PinyinToggle({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
      <Checkbox checked={checked} onCheckedChange={(value) => onCheckedChange(Boolean(value))} />
      Hiện pinyin
    </label>
  );
}

function TooltipToggle({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
      <Checkbox checked={checked} onCheckedChange={(value) => onCheckedChange(Boolean(value))} />
      Tooltip
    </label>
  );
}

function MarkRecordLearnedButton({
  text,
  learnedChars,
  onMarkLearned,
  compact = false,
}: {
  text: string;
  learnedChars: Set<string>;
  onMarkLearned: (chars: string[]) => void;
  compact?: boolean;
}) {
  const chars = collectChineseChars(text);
  const newChars = chars.filter((ch) => !learnedChars.has(ch));
  const disabled = chars.length === 0 || newChars.length === 0;
  const label =
    chars.length === 0
      ? "Không có chữ Hán"
      : newChars.length > 0
        ? compact
          ? "Đánh dấu"
          : "Đánh dấu văn bản"
        : compact
          ? "Đã học"
          : "Văn bản đã học";

  return (
    <button
      onClick={(event) => {
        event.stopPropagation();
        onMarkLearned(newChars);
      }}
      disabled={disabled}
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border text-sm font-medium",
        compact ? "px-2 py-1" : "px-3 py-2",
        "bg-background hover:bg-accent transition-colors disabled:opacity-60 disabled:hover:bg-background"
      )}
      title={disabled ? "Tất cả chữ trong văn bản này đã được đánh dấu" : "Đánh dấu tất cả chữ trong văn bản này là đã học"}
    >
      <BookmarkCheck className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      {label}
    </button>
  );
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`GET ${path} failed`);
  return res.json() as Promise<T>;
}

export function TextSection() {
  const allChars = useMemo(() => getAllCharacters(), []);
  const charMap = useMemo(() => new Map(allChars.map((c) => [c.char, c])), [allChars]);
  const { learnedChars, markLearned } = useLearnedChars();
  const [userEdits, setUserEdits] = useState<Record<string, UserEdits>>({});
  const [title, setTitle] = useState("");
  const [input, setInput] = useState("");
  const [currentTitle, setCurrentTitle] = useState("");
  const [currentText, setCurrentText] = useState("");
  const [saveOnSubmit, setSaveOnSubmit] = useState(false);
  const [showTextPinyin, setShowTextPinyin] = useState(false);
  const [showHistoryPinyin, setShowHistoryPinyin] = useState(false);
  const [enableTextTooltip, setEnableTextTooltip] = useState(true);
  const [enableHistoryTooltip, setEnableHistoryTooltip] = useState(true);
  const [texts, setTexts] = useState<SavedText[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editText, setEditText] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [textError, setTextError] = useState("");
  const [historyError, setHistoryError] = useState("");

  const selectedText = useMemo(
    () => texts.find((item) => item.id === selectedId) ?? texts[0],
    [selectedId, texts]
  );

  const renderDate = (value: string) =>
    new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });

  const displayTitle = (item: Pick<SavedText, "title" | "createdAt">) =>
    item.title || renderDate(item.createdAt);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      setHistoryError("");
      const data = await apiGet<{ texts?: SavedText[] }>("/api/chinese/texts");
      const nextTexts = data.texts ?? [];
      setTexts(nextTexts);
      setEditingId(null);
      setSelectedId((current) => {
        if (current && nextTexts.some((item) => item.id === current)) return current;
        return nextTexts[0]?.id ?? null;
      });
    } catch {
      setHistoryError("Không tải được lịch sử văn bản.");
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    apiGet<Record<string, UserEdits>>("/api/chinese/edits")
      .then((edits) => setUserEdits(edits))
      .catch(() => {});
    void loadHistory();
  }, [loadHistory]);

  const saveText = useCallback(async (text: string, nextTitle?: string) => {
    const res = await fetch("/api/chinese/texts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, title: nextTitle }),
    });
    if (!res.ok) throw new Error("save failed");
    const data = (await res.json()) as { item?: SavedText };
    if (data.item) {
      setTexts((prev) => [data.item!, ...prev.filter((item) => item.id !== data.item!.id)]);
      setSelectedId(data.item.id);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    const text = input.trim();
    const nextTitle = title.trim();
    if (!text) {
      setTextError("Nhập hoặc paste văn bản trước khi submit.");
      return;
    }

    setCurrentText(text);
    setCurrentTitle(nextTitle);
    setTextError("");

    if (!saveOnSubmit) return;

    setSaving(true);
    try {
      await saveText(text, nextTitle || undefined);
    } catch {
      setTextError("Không lưu được văn bản. Đoạn văn vẫn đang hiển thị bên dưới.");
    } finally {
      setSaving(false);
    }
  }, [input, title, saveOnSubmit, saveText]);

  const startEdit = useCallback((item: SavedText) => {
    setSelectedId(item.id);
    setEditingId(item.id);
    setEditTitle(item.title ?? "");
    setEditText(item.text);
    setHistoryError("");
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditTitle("");
    setEditText("");
  }, []);

  const handleDelete = useCallback(async (id: number) => {
    await fetch("/api/chinese/texts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setTexts((prev) => {
      const next = prev.filter((item) => item.id !== id);
      setSelectedId(next[0]?.id ?? null);
      return next;
    });
    if (editingId === id) cancelEdit();
  }, [cancelEdit, editingId]);

  const handleUpdate = useCallback(async () => {
    if (!editingId) return;
    const text = editText.trim();
    const nextTitle = editTitle.trim();
    if (!text) {
      setHistoryError("Văn bản không được để trống.");
      return;
    }

    setUpdating(true);
    setHistoryError("");
    try {
      const res = await fetch("/api/chinese/texts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, title: nextTitle, text }),
      });
      if (!res.ok) throw new Error("update failed");
      const data = (await res.json()) as { item?: SavedText };
      if (data.item) {
        setTexts((prev) => prev.map((item) => (item.id === data.item!.id ? data.item! : item)));
        setSelectedId(data.item.id);
      }
      cancelEdit();
    } catch {
      setHistoryError("Không cập nhật được văn bản.");
    } finally {
      setUpdating(false);
    }
  }, [cancelEdit, editText, editTitle, editingId]);

  return (
    <Tabs defaultValue="text" className="space-y-6">
      <TabsList className="w-fit">
        <TabsTrigger value="text" className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Văn bản
        </TabsTrigger>
        <TabsTrigger value="history" className="flex items-center gap-2">
          <History className="h-4 w-4" />
          Lịch sử
        </TabsTrigger>
      </TabsList>

      <TabsContent value="text">
        <div className="space-y-5">
          <div className="space-y-3">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Tiêu đề (optional)"
              style={{ fontFamily: "var(--font-noto-serif-sc), serif" }}
            />
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste hoặc gõ đoạn văn chữ Hán..."
              className="min-h-40 text-base leading-relaxed"
              style={{ fontFamily: "var(--font-noto-serif-sc), serif" }}
            />
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                <Checkbox
                  checked={saveOnSubmit}
                  onCheckedChange={(value) => setSaveOnSubmit(Boolean(value))}
                />
                Lưu vào lịch sử
              </label>
              <button
                onClick={() => void handleSubmit()}
                disabled={saving}
                className={cn(
                  "ml-auto flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium",
                  "bg-background hover:bg-accent transition-colors disabled:opacity-60"
                )}
              >
                {saveOnSubmit ? <Save className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                {saving ? "Đang lưu..." : "Submit"}
              </button>
            </div>
            {textError && <p className="text-sm text-destructive">{textError}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <PinyinToggle checked={showTextPinyin} onCheckedChange={setShowTextPinyin} />
            <TooltipToggle checked={enableTextTooltip} onCheckedChange={setEnableTextTooltip} />
          </div>

          {currentText ? (
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="mb-4 flex justify-end">
                <MarkRecordLearnedButton
                  text={currentText}
                  learnedChars={learnedChars}
                  onMarkLearned={markLearned}
                />
              </div>
              {currentTitle && (
                <div className="mb-4 font-semibold">
                  <ChineseTextDisplay
                    text={currentTitle}
                    charMap={charMap}
                    userEdits={userEdits}
                    showPinyin={showTextPinyin}
                    enableTooltip={enableTextTooltip}
                    className="text-lg"
                  />
                </div>
              )}
              <ChineseTextDisplay
                text={currentText}
                charMap={charMap}
                userEdits={userEdits}
                showPinyin={showTextPinyin}
                enableTooltip={enableTextTooltip}
                className="text-2xl"
              />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border px-5 py-12 text-center text-sm text-muted-foreground">
              Đoạn văn sau khi submit sẽ hiển thị ở đây.
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="history">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <PinyinToggle checked={showHistoryPinyin} onCheckedChange={setShowHistoryPinyin} />
            <TooltipToggle
              checked={enableHistoryTooltip}
              onCheckedChange={setEnableHistoryTooltip}
            />
          </div>
          {historyError && <p className="text-sm text-destructive">{historyError}</p>}

          {loadingHistory && (
            <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
              <div className="w-6 h-6 border-2 border-border border-t-foreground rounded-full animate-spin" />
              <p className="text-sm">Đang tải...</p>
            </div>
          )}

          {!loadingHistory && texts.length === 0 && (
            <div className="py-20 text-center text-muted-foreground text-sm">
              Chưa có văn bản nào được lưu.
            </div>
          )}

          {!loadingHistory && texts.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-[minmax(220px,320px)_1fr]">
              <div className="space-y-2">
                {texts.map((item) => {
                  const selected = selectedText?.id === item.id;
                  const preview = Array.from(item.text).slice(0, 28).join("");
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "flex items-start gap-2 rounded-lg border border-border p-3 transition-colors",
                        selected ? "bg-accent" : "hover:bg-accent/60"
                      )}
                    >
                      <button
                        className="min-w-0 flex-1 text-left"
                        onClick={() => {
                          setSelectedId(item.id);
                          if (editingId !== item.id) cancelEdit();
                        }}
                      >
                        <span className="block truncate text-sm font-medium">
                          {displayTitle(item)}
                        </span>
                        <span
                          className="mt-1 block truncate text-sm text-muted-foreground"
                          style={{ fontFamily: "var(--font-noto-serif-sc), serif" }}
                        >
                          {preview}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {renderDate(item.createdAt)}
                        </span>
                      </button>
                      <button
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        onClick={() => startEdit(item)}
                        title="Sửa"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <MarkRecordLearnedButton
                        text={item.text}
                        learnedChars={learnedChars}
                        onMarkLearned={markLearned}
                        compact
                      />
                      <button
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        onClick={() => void handleDelete(item.id)}
                        title="Xóa"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="min-h-60 rounded-lg border border-border bg-card p-5">
                {selectedText && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Eye className="h-3.5 w-3.5" />
                      {renderDate(selectedText.createdAt)}
                    </div>
                    {editingId === selectedText.id ? (
                      <div className="space-y-3">
                        <Input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          placeholder="Tiêu đề (optional)"
                          style={{ fontFamily: "var(--font-noto-serif-sc), serif" }}
                        />
                        <Textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="min-h-40 text-base leading-relaxed"
                          style={{ fontFamily: "var(--font-noto-serif-sc), serif" }}
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={cancelEdit}
                            disabled={updating}
                            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-accent transition-colors disabled:opacity-60"
                          >
                            <X className="h-4 w-4" />
                            Hủy
                          </button>
                          <button
                            onClick={() => void handleUpdate()}
                            disabled={updating}
                            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-60"
                          >
                            <Save className="h-4 w-4" />
                            {updating ? "Đang lưu..." : "Lưu"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <div className="min-w-0 flex-1 font-semibold">
                            <ChineseTextDisplay
                              text={displayTitle(selectedText)}
                              charMap={charMap}
                              userEdits={userEdits}
                              showPinyin={showHistoryPinyin}
                              enableTooltip={enableHistoryTooltip}
                              className="text-lg"
                            />
                          </div>
                          <button
                            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                            onClick={() => startEdit(selectedText)}
                            title="Sửa"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </div>
                        <ChineseTextDisplay
                          text={selectedText.text}
                          charMap={charMap}
                          userEdits={userEdits}
                          showPinyin={showHistoryPinyin}
                          enableTooltip={enableHistoryTooltip}
                          className="text-xl"
                        />
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
