"use client";

import { useState, useEffect, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { Button } from "@/src/components/ui/Button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/src/components/ui/Dialog";
import { cn } from "@/src/utils/ui";
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, Bold, Italic, UnderlineIcon, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Heading2, Heading3, Minus } from "lucide-react";
import { useEditAuth } from "../study/useEditAuth";
import { KeyPromptModal } from "../study/KeyPromptModal";
import type { GrammarPost } from "@/src/lib/chinese-db";

// ── API helpers ───────────────────────────────────────────────────────────────

const API = "/api/chinese/grammar-posts";

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`GET ${path} failed`);
  return res.json() as Promise<T>;
}

async function apiMutate(method: string, body: unknown): Promise<void> {
  const res = await fetch(API, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${API} failed`);
}

// ── Post form dialog ──────────────────────────────────────────────────────────

interface PostFormDialogProps {
  open: boolean;
  initial?: GrammarPost | null;
  onClose: () => void;
  onSave: (title: string, content: string) => Promise<void>;
}

function ToolbarBtn({ active, onClick, children, title }: { active?: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={cn(
        "p-1.5 rounded transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function RichEditor({ content, onChange }: { content: string; onChange: (html: string) => void }) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "min-h-[400px] px-4 py-3 text-sm focus:outline-none prose prose-sm max-w-none dark:prose-invert",
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  // only sync when content prop changes externally (dialog open/reset)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, content]);

  if (!editor) return null;

  return (
    <div className="rounded-md border border-input overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-0.5 p-1.5 border-b border-border bg-muted/40">
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

        <ToolbarBtn title="Tiêu đề 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn title="Tiêu đề 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading3 className="w-3.5 h-3.5" />
        </ToolbarBtn>

        <span className="w-px bg-border mx-1" />

        <ToolbarBtn title="Danh sách" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn title="Danh sách số" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolbarBtn>

        <span className="w-px bg-border mx-1" />

        <ToolbarBtn title="Căn trái" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
          <AlignLeft className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn title="Căn giữa" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
          <AlignCenter className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn title="Căn phải" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
          <AlignRight className="w-3.5 h-3.5" />
        </ToolbarBtn>

        <span className="w-px bg-border mx-1" />

        <ToolbarBtn title="Đường kẻ ngang" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <Minus className="w-3.5 h-3.5" />
        </ToolbarBtn>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}

function PostFormDialog({ open, initial, onClose, onSave }: PostFormDialogProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? "");
      setContent(initial?.content ?? "");
    }
  }, [open, initial]);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave(title, content);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl w-full max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{initial ? "Sửa bài" : "Thêm bài ngữ pháp"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 overflow-y-auto flex-1 pr-1">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Tiêu đề</label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              rows={2}
              placeholder="Tiêu đề bài..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Nội dung</label>
            {open && <RichEditor content={content} onChange={setContent} />}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Hủy</Button>
          <Button onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? "Đang lưu..." : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Post item (collapse bar) ──────────────────────────────────────────────────

interface PostItemProps {
  post: GrammarPost;
  onEdit: (post: GrammarPost) => void;
  onDelete: (id: number) => void;
}

function PostItem({ post, onEdit, onDelete }: PostItemProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div
        className="w-full flex items-start gap-2 px-4 py-3 text-left hover:bg-accent transition-colors cursor-pointer"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="mt-0.5 shrink-0 text-muted-foreground">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
        <span className="text-sm font-medium whitespace-pre-wrap flex-1">{post.title}</span>
        <span className="flex gap-1 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
            <button
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => onEdit(post)}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              onClick={() => onDelete(post.id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </span>
      </div>

      {open && (
        <div
          className="px-6 py-4 border-t border-border text-sm prose prose-sm max-w-none dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />
      )}
    </div>
  );
}

// ── Main GrammarTab ───────────────────────────────────────────────────────────

export function GrammarTab() {
  const [posts, setPosts] = useState<GrammarPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<GrammarPost | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const { auth, requestEdit, submitKey, dismiss } = useEditAuth();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<GrammarPost[]>(API);
      setPosts(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // When auth becomes verified, run any pending action
  useEffect(() => {
    if (auth.status === "verified" && pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  }, [auth.status, pendingAction]);

  function withAuth(action: () => void) {
    if (auth.status === "verified") {
      action();
    } else {
      setPendingAction(() => action);
      requestEdit();
    }
  }

  function handleAdd() {
    withAuth(() => {
      setEditing(null);
      setFormOpen(true);
    });
  }

  function handleEdit(post: GrammarPost) {
    withAuth(() => {
      setEditing(post);
      setFormOpen(true);
    });
  }

  function handleDelete(id: number) {
    withAuth(async () => {
      if (!confirm("Xóa bài này?")) return;
      await apiMutate("DELETE", { id });
      setPosts((prev) => prev.filter((p) => p.id !== id));
    });
  }

  async function handleSave(title: string, content: string) {
    if (editing) {
      await apiMutate("PUT", { id: editing.id, title, content });
    } else {
      await apiMutate("POST", { title, content });
    }
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{posts.length} bài</p>
        <Button size="sm" onClick={handleAdd}>
          <Plus className="w-4 h-4 mr-1" />
          Thêm bài
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          <div className="w-6 h-6 border-2 border-border border-t-foreground rounded-full animate-spin" />
          <p className="text-sm">Đang tải...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground text-sm">Chưa có bài nào. Thêm bài đầu tiên!</div>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <PostItem
              key={post.id}
              post={post}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <PostFormDialog
        open={formOpen}
        initial={editing}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
      />

      {auth.status === "prompting" && (
        <KeyPromptModal onSubmit={submitKey} onDismiss={dismiss} />
      )}
    </div>
  );
}
