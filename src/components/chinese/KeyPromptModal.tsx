"use client";

import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/src/components/ui/Dialog";
import { Button } from "@/src/components/ui/Button";

interface KeyPromptModalProps {
  onSubmit: (key: string) => Promise<"ok" | "wrong" | "locked">;
  onDismiss: () => void;
}

export function KeyPromptModal({ onSubmit, onDismiss }: KeyPromptModalProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  async function handleSubmit() {
    if (!value.trim()) return;
    setLoading(true);
    setError("");
    const result = await onSubmit(value.trim());
    setLoading(false);
    if (result === "ok") return; // modal closes via auth state
    if (result === "locked") {
      setError("Chức năng chỉnh sửa bị khoá.");
    } else {
      setValue("");
      setError("Sai key.");
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onDismiss()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Nhập key chỉnh sửa</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <input
            ref={inputRef}
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Key..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            disabled={loading}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onDismiss} disabled={loading}>Huỷ</Button>
          <Button onClick={handleSubmit} disabled={loading || !value.trim()}>
            {loading ? "Đang kiểm tra..." : "Xác nhận"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
