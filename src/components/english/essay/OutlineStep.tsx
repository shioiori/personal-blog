"use client";

import { Fragment } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import type { EssayPart, EssayPartType } from "@/src/declaration/english";
import { Textarea } from "@/src/components/ui/Textarea";
import { Button } from "@/src/components/ui/Button";
import {
  PART_LABEL_VI,
  MIN_BODY_COUNT,
  bodyIndices,
  addBody,
  removeBody,
  addOptionalPart,
  removeOptionalPart,
  moveBody,
  movePartWithinBody,
} from "@/src/lib/essay-format";
import { cn } from "@/src/utils/ui";

interface OutlineStepProps {
  parts: EssayPart[];
  onChange: (parts: EssayPart[]) => void;
}

function PartBox({ part, onChange }: { part: EssayPart; onChange: (text: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground pr-20 block">{PART_LABEL_VI[part.type]}</label>
      <Textarea
        value={part.outlineText}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Viết dàn ý cho phần "${PART_LABEL_VI[part.type]}"...`}
        className="min-h-20"
      />
    </div>
  );
}

const OPTIONAL_BUTTONS: { type: EssayPartType; label: string }[] = [
  { type: "body_explain", label: "+ Giải thích" },
  { type: "body_example", label: "+ Ví dụ" },
  { type: "body_link", label: "+ Liên kết" },
];

export function OutlineStep({ parts, onChange }: OutlineStepProps) {
  function updatePart(id: string, outlineText: string) {
    onChange(parts.map((p) => (p.id === id ? { ...p, outlineText } : p)));
  }

  const bodies = bodyIndices(parts);
  const overallParts = parts.filter((p) => p.type === "overall_paraphrase" || p.type === "overall_mainidea");
  const conclusion = parts.find((p) => p.type === "conclusion");

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold">Mở bài (Overall)</h3>
        {overallParts.map((p) => (
          <PartBox key={p.id} part={p} onChange={(text) => updatePart(p.id, text)} />
        ))}
      </section>

      {bodies.map((bodyIndex, bodyPos) => {
        const bodyParts = parts.filter((p) => p.bodyIndex === bodyIndex);
        return (
          <section key={bodyIndex} className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Body {bodyIndex + 1}</h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onChange(moveBody(parts, bodyIndex, "up"))}
                  disabled={bodyPos === 0}
                  className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:hover:text-muted-foreground"
                  title="Chuyển lên"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onChange(moveBody(parts, bodyIndex, "down"))}
                  disabled={bodyPos === bodies.length - 1}
                  className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:hover:text-muted-foreground"
                  title="Chuyển xuống"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                {bodies.length > MIN_BODY_COUNT && (
                  <button
                    onClick={() => onChange(removeBody(parts, bodyIndex))}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    title="Xoá body này"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            {bodyParts.map((p, partPos) => (
              <Fragment key={p.id}>
                <div className={cn("relative", p.type !== "body_point" && "pl-3 border-l-2 border-muted")}>
                  <PartBox part={p} onChange={(text) => updatePart(p.id, text)} />
                  <div className="absolute right-0 top-0 flex items-center gap-1">
                    <button
                      onClick={() => onChange(movePartWithinBody(parts, p.id, "up"))}
                      disabled={partPos === 0}
                      className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:hover:text-muted-foreground"
                      title="Chuyển lên"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => onChange(movePartWithinBody(parts, p.id, "down"))}
                      disabled={partPos === bodyParts.length - 1}
                      className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:hover:text-muted-foreground"
                      title="Chuyển xuống"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    {p.type !== "body_point" && (
                      <button
                        onClick={() => onChange(removeOptionalPart(parts, p.id))}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        title="Xoá phần này"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </Fragment>
            ))}
            <div className="flex flex-wrap gap-2 pt-1">
              {OPTIONAL_BUTTONS.map((btn) => (
                <Button
                  key={btn.type}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onChange(addOptionalPart(parts, bodyIndex, btn.type))}
                >
                  {btn.label}
                </Button>
              ))}
            </div>
          </section>
        );
      })}

      <Button type="button" variant="outline" onClick={() => onChange(addBody(parts))} className="gap-1.5">
        <Plus className="h-4 w-4" /> Thêm body
      </Button>

      {conclusion && (
        <section className="space-y-3 rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold">Kết bài (Conclusion)</h3>
          <PartBox part={conclusion} onChange={(text) => updatePart(conclusion.id, text)} />
        </section>
      )}
    </div>
  );
}
