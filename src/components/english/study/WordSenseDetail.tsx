"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { EnglishSense, EnglishWord } from "@/src/declaration/english";
import { imageUrl } from "./imageUpload";

export function parseRelatedWords(text: string): string[] {
  return text
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean);
}

const POS_ABBREV: Record<string, string> = {
  noun: "n",
  verb: "v",
  adjective: "adj",
  adverb: "adv",
  preposition: "prep",
  pronoun: "pron",
  conjunction: "conj",
  interjection: "interj",
  phrase: "phr",
  idiom: "idiom",
  "phrasal verb": "phr.v",
  collocation: "coll",
};

function abbreviatePos(pos?: string): string {
  if (!pos) return "";
  const key = pos.trim().toLowerCase();
  return POS_ABBREV[key] ?? key;
}

export function ImageThumb({ src, onRemove }: { src: string; onRemove?: () => void }) {
  return (
    <div className="relative w-20 h-20 shrink-0">
      <a href={src} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt="" className="w-full h-full object-cover rounded-md border border-border" />
      </a>
      {onRemove && (
        <button
          onClick={onRemove}
          className="absolute -top-1.5 -right-1.5 rounded-full bg-background border border-border p-0.5 text-muted-foreground hover:text-destructive"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

export function WordSenseList({ senses }: { senses: EnglishSense[] }) {
  const t = useTranslations("English");
  if (senses.length === 0) return <p className="text-sm text-muted-foreground italic">{t("Words.noSenses")}</p>;
  return (
    <>
      {senses.map((s, i) => (
        <div key={i} className="rounded-lg border border-border p-3 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            {s.partOfSpeech && (
              <span className="inline-block px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium uppercase text-muted-foreground">
                {s.partOfSpeech}
              </span>
            )}
            {s.phonetic && <span className="text-xs text-muted-foreground">/{s.phonetic}/</span>}
          </div>
          {s.meaningVi && <p className="text-sm font-medium">{s.meaningVi}</p>}
          {s.cambridgeMeaning && <p className="text-sm text-muted-foreground italic">{s.cambridgeMeaning}</p>}
          {s.example && <p className="text-xs text-muted-foreground">&quot;{s.example}&quot;</p>}
          {(s.synonyms || s.antonyms) && (
            <p className="text-xs text-muted-foreground">
              {s.synonyms && <>{t("Common.synonyms", { value: s.synonyms })} </>}
              {s.antonyms && <>{t("Common.antonyms", { value: s.antonyms })}</>}
            </p>
          )}
          {s.note && <p className="text-xs whitespace-pre-line border-t border-border pt-1.5">{s.note}</p>}
          {(s.images?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {s.images!.map((key) => <ImageThumb key={key} src={imageUrl(key)} />)}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

export function RelatedWordChips({
  relatedWords,
  allWords,
  onOpenWord,
}: {
  relatedWords: string;
  allWords: EnglishWord[];
  onOpenWord?: (id: number) => void;
}) {
  const t = useTranslations("English");
  const list = parseRelatedWords(relatedWords);
  if (list.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{t("Common.relatedWords")}</span>
      {list.map((rw) => {
        const match = allWords.find((w) => w.word.toLowerCase() === rw.toLowerCase());
        const pos = abbreviatePos(match?.senses[0]?.partOfSpeech);
        return match && onOpenWord ? (
          <button
            key={rw}
            onClick={() => onOpenWord(match.id)}
            className="px-2 py-0.5 rounded-full bg-muted text-xs hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            {rw}
            {pos && <span className="text-muted-foreground"> ({pos})</span>}
          </button>
        ) : (
          <span key={rw} className={`px-2 py-0.5 rounded-full text-xs ${match ? "bg-muted" : "bg-muted/50 text-muted-foreground italic"}`}>
            {rw}
            {pos && <span className="text-muted-foreground"> ({pos})</span>}
          </span>
        );
      })}
    </div>
  );
}
