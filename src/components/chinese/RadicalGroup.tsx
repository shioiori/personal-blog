"use client";

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

interface RadicalGroupProps {
  radical: string;
  radicalName: string;
  characters: CharacterInfo[];
  isOpen: boolean;
  onToggle: (radical: string) => void;
  hiddenCards: Set<string>;
  onToggleHide: (char: string) => void;
}

export function RadicalGroup({
  radical,
  radicalName,
  characters,
  isOpen,
  onToggle,
  hiddenCards,
  onToggleHide,
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
              {radical}
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
          {characters.map((c) => (
            <CharacterCard
              key={c.char}
              info={c}
              hidden={hiddenCards.has(c.char)}
              onToggleHide={onToggleHide}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
