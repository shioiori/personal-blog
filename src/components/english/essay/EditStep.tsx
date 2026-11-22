"use client";

import { useEffect, useMemo, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { Bold, Italic, Underline as UnderlineIcon, SpellCheck2, RefreshCw, Eye, EyeOff } from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import { cn } from "@/src/utils/ui";
import { diffWords } from "@/src/lib/text-diff";
import { textToHtml } from "@/src/lib/plain-text";
import type { EssaySpellIssue } from "@/src/declaration/english";

function ToolbarBtn({ active, onClick, children, title }: { active?: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={cn(
        "p-1.5 rounded transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

interface EditStepProps {
  text: string;
  /** Latest combined translation text (from step 2) — may have diverged from `text` if the user edited step 2 after already editing here. */
  joinedText: string;
  onChange: (text: string) => void;
}

export function EditStep({ text, joinedText, onChange }: EditStepProps) {
  const [issues, setIssues] = useState<EssaySpellIssue[]>([]);
  const [dismissedSync, setDismissedSync] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState("");

  const [showDiff, setShowDiff] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, Underline],
    content: textToHtml(text),
    onUpdate({ editor }) {
      onChange(editor.getText({ blockSeparator: "\n\n" }));
    },
    editorProps: {
      attributes: {
        class: "min-h-[400px] px-4 py-3 text-sm focus:outline-none prose prose-sm max-w-none dark:prose-invert",
      },
    },
  });

  useEffect(() => {
    if (editor && text !== editor.getText({ blockSeparator: "\n\n" })) {
      editor.commands.setContent(textToHtml(text), { emitUpdate: false });
    }
    // only sync when text changes externally (e.g. switching essay / step)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // Re-surface the sync banner whenever the translation changes again, even if
  // the user dismissed it for a previous version.
  useEffect(() => {
    setDismissedSync(false);
    setShowDiff(false);
  }, [joinedText]);

  const diff = useMemo(() => diffWords(text, joinedText), [text, joinedText]);

  async function handleSpellcheck() {
    if (!editor) return;
    setChecking(true);
    setCheckError("");
    try {
      const plainText = editor.getText({ blockSeparator: "\n\n" });
      const res = await fetch("/api/english/essay/spellcheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: plainText }),
      });
      const data = (await res.json()) as { issues?: EssaySpellIssue[]; needsPremium?: boolean };
      if (!res.ok) {
        setCheckError(data.needsPremium ? "Check chính tả cần tài khoản Premium." : "Không check được, thử lại sau.");
        return;
      }
      setIssues(data.issues ?? []);
    } catch {
      setCheckError("Không check được, thử lại sau.");
    } finally {
      setChecking(false);
    }
  }

  const hasPendingSync = joinedText.trim() !== text.trim() && !dismissedSync;

  function syncFromTranslation() {
    if (!editor) return;
    editor.commands.setContent(textToHtml(joinedText));
    onChange(joinedText);
    setDismissedSync(false);
    setShowDiff(false);
  }

  function applyIssue(issue: EssaySpellIssue) {
    if (!editor || !issue.suggestion) return;
    const plainText = editor.getText({ blockSeparator: "\n\n" });
    const fixed = plainText.replace(issue.original, issue.suggestion);
    editor.commands.setContent(textToHtml(fixed));
    onChange(fixed);
    setIssues((prev) => prev.filter((i) => i !== issue));
  }

  if (!editor) return null;

  return (
    <div className="space-y-4">
      {hasPendingSync && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 text-sm overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-3 py-2">
            <span>Bản dịch ở bước 2 đã thay đổi so với bản đang chỉnh sửa ở đây.</span>
            <div className="flex items-center gap-2 shrink-0">
              <Button type="button" size="sm" variant="outline" onClick={() => setShowDiff((v) => !v)} className="gap-1.5">
                {showDiff ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showDiff ? "Ẩn thay đổi" : "Xem thay đổi"}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setDismissedSync(true)}>
                Bỏ qua
              </Button>
              <Button type="button" size="sm" onClick={syncFromTranslation} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> Đồng bộ lại
              </Button>
            </div>
          </div>
          {showDiff && (
            <div className="border-t border-amber-500/40 bg-background/60 px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap">
              {diff.map((token, idx) => {
                if (token.type === "equal") return <span key={idx}>{token.value}</span>;
                if (token.type === "remove")
                  return (
                    <span key={idx} className="bg-red-500/20 text-red-700 dark:text-red-400 line-through">
                      {token.value}
                    </span>
                  );
                return (
                  <span key={idx} className="bg-green-500/20 text-green-700 dark:text-green-400">
                    {token.value}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="rounded-md border border-input overflow-hidden">
        <div className="flex flex-wrap items-center gap-0.5 p-1.5 border-b border-border bg-muted/40">
          <ToolbarBtn title="Đậm" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
            <Bold className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Nghiêng" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <Italic className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Gạch chân" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
            <UnderlineIcon className="w-3.5 h-3.5" />
          </ToolbarBtn>

          <span className="w-px bg-border mx-1" />

          <Button type="button" variant="outline" size="sm" onClick={handleSpellcheck} disabled={checking} className="ml-auto gap-1.5">
            <SpellCheck2 className="h-3.5 w-3.5" />
            {checking ? "Đang check..." : "Check chính tả"}
          </Button>
        </div>

        <EditorContent editor={editor} />
      </div>

      {checkError && <p className="text-sm text-destructive">{checkError}</p>}

      {issues.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">{issues.length} lỗi tìm thấy</h4>
          {issues.map((issue, idx) => (
            <div key={idx} className="rounded-lg border border-border p-3 space-y-1.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {issue.type === "spelling" ? "Chính tả" : "Ngữ pháp"}
                </span>
                {issue.suggestion && (
                  <Button type="button" size="sm" variant="outline" onClick={() => applyIssue(issue)}>
                    Sửa
                  </Button>
                )}
              </div>
              <p>
                <span className="line-through text-destructive">{issue.original}</span>
                {issue.suggestion && <span className="text-primary"> → {issue.suggestion}</span>}
              </p>
              {issue.explanation && <p className="text-xs text-muted-foreground">{issue.explanation}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
