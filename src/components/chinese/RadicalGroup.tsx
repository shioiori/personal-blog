"use client";

import { memo } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/src/utils/ui";
import { Badge } from "@/src/components/ui/Badge";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/src/components/ui/Collapsible";
import { CharacterCard } from "./CharacterCard";
import type { CharacterInfo } from "@/src/data/chinese";
import type { UserEdits } from "./EditCardModal";

interface RadicalGroupProps {
  radical: string;
  radicalName: string;
  characters: CharacterInfo[];
  isOpen: boolean;
  onToggle: (radical: string) => void;
  hiddenCards: Set<string>;
  showKnownOnly?: boolean;
  onToggleHide: (char: string) => void;
  onNavigate: (char: string) => void;
  onSave: (char: string, edits: UserEdits) => void;
  userEdits: Record<string, UserEdits>;
  onEditRequest: () => boolean;
  editLocked: boolean;
}

function RadicalGroupInner({
  radical,
  radicalName,
  characters,
  isOpen,
  onToggle,
  hiddenCards,
  showKnownOnly,
  onToggleHide,
  onNavigate,
  onSave,
  userEdits,
  onEditRequest,
  editLocked,
}: RadicalGroupProps) {
  return (
    <Collapsible open={isOpen} onOpenChange={() => onToggle(radical)}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-card hover:bg-accent transition-colors">
          <span className="flex items-center gap-3">
            <span
              className="text-3xl leading-none"
              style={{ fontFamily: "var(--font-noto-serif-sc), 'SimSun', serif" }}
            >
              {radical === "__unknown__" ? "?" : radical}
            </span>
            <span className="text-sm text-muted-foreground">{radicalName}</span>
            <Badge variant="secondary" className="text-xs">
              {characters.length}
            </Badge>
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 pt-3 pb-1 px-1">
          {isOpen && (showKnownOnly ? characters.filter((c) => hiddenCards.has(c.char)) : characters).map((c) => (
            <CharacterCard
              key={c.char}
              info={c}
              edits={userEdits[c.char] ?? {}}
              hidden={hiddenCards.has(c.char)}
              onToggleHide={onToggleHide}
              onNavigate={onNavigate}
              onSave={onSave}
              onEditRequest={onEditRequest}
              editLocked={editLocked}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export const RadicalGroup = memo(RadicalGroupInner, (prev, next) => {
  if (prev.radical !== next.radical) return false;
  if (prev.isOpen !== next.isOpen) return false;
  if (prev.editLocked !== next.editLocked) return false;
  if (prev.characters !== next.characters) return false;
  if (prev.userEdits !== next.userEdits) return false;
  if (prev.onToggle !== next.onToggle) return false;
  if (prev.onToggleHide !== next.onToggleHide) return false;
  if (prev.onNavigate !== next.onNavigate) return false;
  if (prev.onSave !== next.onSave) return false;
  if (prev.onEditRequest !== next.onEditRequest) return false;
  if (prev.showKnownOnly !== next.showKnownOnly) return false;
  // Only re-render if hidden status of chars in this group actually changed
  const chars = next.characters.map((c) => c.char);
  return chars.every((ch) => prev.hiddenCards.has(ch) === next.hiddenCards.has(ch));
});
