"use client";

import { useState } from "react";
import { Pencil, Check } from "lucide-react";
import type { EssayPart } from "@/src/declaration/english";
import { Textarea } from "@/src/components/ui/Textarea";
import { PART_LABEL_VI, bodyIndices } from "@/src/lib/essay-format";

interface TranslateStepProps {
  parts: EssayPart[];
  onChange: (parts: EssayPart[]) => void;
}

function TranslatePartRow({ part, onChange }: { part: EssayPart; onChange: (patch: Partial<EssayPart>) => void }) {
  const [editingOutline, setEditingOutline] = useState(false);

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <label className="text-xs font-medium text-muted-foreground">{PART_LABEL_VI[part.type]}</label>
        <button
          onClick={() => setEditingOutline((v) => !v)}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          title={editingOutline ? "Xong" : "Sửa nhanh dàn ý"}
        >
          {editingOutline ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
        </button>
      </div>

      {editingOutline ? (
        <Textarea
          value={part.outlineText}
          onChange={(e) => onChange({ outlineText: e.target.value })}
          className="min-h-16 text-sm"
          autoFocus
        />
      ) : (
        <p className="text-sm whitespace-pre-wrap text-foreground/90 bg-muted/40 rounded px-2 py-1.5">
          {part.outlineText || <span className="italic text-muted-foreground">(chưa có dàn ý)</span>}
        </p>
      )}

      <Textarea
        value={part.translationText}
        onChange={(e) => onChange({ translationText: e.target.value })}
        placeholder="Dịch sang tiếng Anh..."
        className="min-h-16"
      />
    </div>
  );
}

export function TranslateStep({ parts, onChange }: TranslateStepProps) {
  function updatePart(id: string, patch: Partial<EssayPart>) {
    onChange(parts.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  const bodies = bodyIndices(parts);
  const overallParts = parts.filter((p) => p.type === "overall_paraphrase" || p.type === "overall_mainidea");
  const conclusion = parts.find((p) => p.type === "conclusion");

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Mở bài (Overall)</h3>
        {overallParts.map((p) => (
          <TranslatePartRow key={p.id} part={p} onChange={(patch) => updatePart(p.id, patch)} />
        ))}
      </section>

      {bodies.map((bodyIndex) => (
        <section key={bodyIndex} className="space-y-3">
          <h3 className="text-sm font-semibold">Body {bodyIndex + 1}</h3>
          {parts
            .filter((p) => p.bodyIndex === bodyIndex)
            .map((p) => (
              <TranslatePartRow key={p.id} part={p} onChange={(patch) => updatePart(p.id, patch)} />
            ))}
        </section>
      ))}

      {conclusion && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Kết bài (Conclusion)</h3>
          <TranslatePartRow part={conclusion} onChange={(patch) => updatePart(conclusion.id, patch)} />
        </section>
      )}
    </div>
  );
}
