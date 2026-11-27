"use client";

import { useEffect, useState } from "react";
import { useEditor, useEditorState, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { Bold, Italic, Underline as UnderlineIcon, SpellCheck2, Check, X } from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import { cn } from "@/src/utils/ui";
import { blocksToText, textToHtml } from "@/src/lib/plain-text";
import type { EssaySpellIssue } from "@/src/declaration/english";
import {
  SpellSuggestions,
  acceptSuggestions,
  getSuggestions,
  locateIssues,
  rejectSuggestions,
  setSuggestions,
} from "./spell-suggestions";

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

/** Plain text of the editor: top-level blocks joined by "\n\n", empty paragraphs kept as extra "\n" (blank lines). */
function editorText(editor: Editor): string {
  const blocks: string[] = [];
  editor.state.doc.forEach((node) => blocks.push(node.textBetween(0, node.content.size, "\n", "\n")));
  return blocksToText(blocks);
}

function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

interface EssayEditorProps {
  text: string;
  onChange: (text: string) => void;
}

export function EssayEditor({ text, onChange }: EssayEditorProps) {
  const [missingIssues, setMissingIssues] = useState<EssaySpellIssue[]>([]);
  const [checkedNoIssues, setCheckedNoIssues] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState("");

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, Underline, SpellSuggestions],
    content: textToHtml(text),
    onUpdate({ editor }) {
      onChange(editorText(editor));
    },
    editorProps: {
      attributes: {
        class: "essay-editor min-h-[400px] px-4 pt-3 pb-8 text-sm focus:outline-none prose prose-sm max-w-none dark:prose-invert",
      },
    },
  });

  const editorInfo = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor
        ? {
            words: countWords(editor.state.doc.textBetween(0, editor.state.doc.content.size, " ", " ")),
            suggestionIds: getSuggestions(editor.state).map((s) => s.id),
            fixableIds: getSuggestions(editor.state)
              .filter((s) => s.suggestion)
              .map((s) => s.id),
          }
        : { words: 0, suggestionIds: [] as string[], fixableIds: [] as string[] },
    equalityFn: (a, b) =>
      !!a && !!b && a.words === b.words && a.suggestionIds.join() === b.suggestionIds.join() && a.fixableIds.join() === b.fixableIds.join(),
  });

  useEffect(() => {
    if (editor && text !== editorText(editor)) {
      editor.commands.setContent(textToHtml(text), { emitUpdate: false });
    }
    // only sync when text changes externally (e.g. switching essay / draft)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  async function handleSpellcheck() {
    if (!editor) return;
    setChecking(true);
    setCheckError("");
    setCheckedNoIssues(false);
    try {
      const res = await fetch("/api/english/essay/spellcheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: editorText(editor) }),
      });
      const data = (await res.json()) as { issues?: EssaySpellIssue[]; needsPremium?: boolean };
      if (!res.ok) {
        setCheckError(data.needsPremium ? "Check chính tả cần tài khoản Premium." : "Không check được, thử lại sau.");
        return;
      }
      const issues = data.issues ?? [];
      const { found, missing } = locateIssues(editor.state.doc, issues);
      setSuggestions(editor.view, found);
      setMissingIssues(missing);
      setCheckedNoIssues(issues.length === 0);
    } catch {
      setCheckError("Không check được, thử lại sau.");
    } finally {
      setChecking(false);
    }
  }

  if (!editor) return null;

  const suggestionCount = editorInfo?.suggestionIds.length ?? 0;
  const fixableIds = editorInfo?.fixableIds ?? [];

  return (
    <div className="space-y-4">
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

          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {suggestionCount > 0 && (
              <>
                <span className="text-xs text-muted-foreground mr-1">{suggestionCount} lỗi</span>
                {fixableIds.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => acceptSuggestions(editor.view, fixableIds)}
                  >
                    <Check className="h-3.5 w-3.5" /> Sửa tất cả
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => rejectSuggestions(editor.view, editorInfo?.suggestionIds ?? [])}
                >
                  <X className="h-3.5 w-3.5" /> Bỏ qua tất cả
                </Button>
              </>
            )}
            <Button type="button" variant="outline" size="sm" onClick={handleSpellcheck} disabled={checking} className="gap-1.5">
              <SpellCheck2 className="h-3.5 w-3.5" />
              {checking ? "Đang check..." : "Check chính tả"}
            </Button>
          </div>
        </div>

        <div className="relative">
          <EditorContent editor={editor} />
          <span className="pointer-events-none absolute bottom-2 right-3 rounded bg-background/80 px-1.5 py-0.5 text-xs text-muted-foreground tabular-nums">
            {editorInfo?.words ?? 0} words
          </span>
        </div>
      </div>

      {checkError && <p className="text-sm text-destructive">{checkError}</p>}
      {checkedNoIssues && <p className="text-sm text-muted-foreground">Không tìm thấy lỗi nào.</p>}

      {missingIssues.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-muted-foreground">
            {missingIssues.length} lỗi không định vị được trong bài (có thể đoạn văn đã thay đổi)
          </h4>
          {missingIssues.map((issue, idx) => (
            <div key={idx} className="rounded-lg border border-border p-3 space-y-1 text-sm">
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
