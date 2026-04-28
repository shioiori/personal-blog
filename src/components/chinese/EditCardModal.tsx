"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/src/components/ui/Dialog";
import { Button } from "@/src/components/ui/Button";
import type { CharacterInfo } from "@/src/data/chinese";

export interface UserEdits {
  pinyin?: string;
  hanViet?: string;
  meaningVi?: string;
  note?: string;
}

interface EditCardModalProps {
  info: CharacterInfo;
  edits: UserEdits;
  open: boolean;
  onClose: () => void;
  onSave: (char: string, edits: UserEdits) => void;
}

export function EditCardModal({ info, edits, open, onClose, onSave }: EditCardModalProps) {
  const [pinyin, setPinyin] = useState(edits.pinyin ?? "");
  const [hanViet, setHanViet] = useState(edits.hanViet ?? "");
  const [meaningVi, setMeaningVi] = useState(edits.meaningVi ?? "");
  const [note, setNote] = useState(edits.note ?? "");

  useEffect(() => {
    setPinyin(edits.pinyin ?? "");
    setHanViet(edits.hanViet ?? "");
    setMeaningVi(edits.meaningVi ?? "");
    setNote(edits.note ?? "");
  }, [info.char, edits.pinyin, edits.hanViet, edits.meaningVi, edits.note]);

  function handleSave() {
    onSave(info.char, {
      pinyin: pinyin || undefined,
      hanViet: hanViet || undefined,
      meaningVi: meaningVi || undefined,
      note: note || undefined,
    });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            <span
              className="text-4xl leading-none"
              style={{ fontFamily: "var(--font-noto-serif-sc), serif" }}
            >
              {info.char}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Field label="Thuộc bộ thủ">
            <input
              value={`${info.radical} (${info.radicalName})`}
              disabled
              className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
            />
          </Field>
          <Field label="Pinyin">
            <input
              value={pinyin}
              onChange={(e) => setPinyin(e.target.value)}
              placeholder={info.pinyin || "—"}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>
          <Field label="Hán Việt">
            <input
              value={hanViet}
              onChange={(e) => setHanViet(e.target.value)}
              placeholder="Nhập âm Hán Việt..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>
          <Field label="Nghĩa (tiếng Việt)">
            <textarea
              value={meaningVi}
              onChange={(e) => setMeaningVi(e.target.value)}
              placeholder="Nhập nghĩa tiếng Việt..."
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </Field>
          <Field label="Ghi chú">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ghi chú cá nhân..."
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Huỷ</Button>
          <Button onClick={handleSave}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}
