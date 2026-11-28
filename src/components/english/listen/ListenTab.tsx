"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Pause, Play, Repeat, Shuffle, SkipBack, SkipForward, AlertTriangle } from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import { Checkbox } from "@/src/components/ui/Checkbox";
import { Slider } from "@/src/components/ui/Slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/Select";
import { useEnglishStudy } from "@/src/context/english";
import type { EnglishGroup, EnglishWord } from "@/src/declaration/english";
import { cn } from "@/src/utils/ui";
import { sortWords, type SortDir, type SortField } from "../shared/wordFilter";
import { FlashcardProgress } from "../shared/FlashcardCard";
import { DEFAULT_LISTEN_SETTINGS, READ_PARTS, useListenSettings, type ListenSettings, type ReadPart, type ScopeMode } from "./listenSettings";
import { useAutoReader, spellOut, type ActiveSegment } from "./useAutoReader";
import { leadIns, type LeadLang } from "./leadPhrases";
import { WordChecklist } from "./WordChecklist";
import { BROWSER_VOICE_PREFIX, ViVoiceSection, usePiperStore } from "./ViVoiceSection";
import { isPiperVoice } from "./piperVoice";
import { pickVoice, speechSupported, waitForVoices } from "./speechEngine";

const SCOPE_MODES: ScopeMode[] = ["groups", "groupWords", "words"];

const PART_LABEL_KEY: Record<ReadPart, string> = {
  word: "partWord",
  spelling: "partSpelling",
  partOfSpeech: "partPartOfSpeech",
  meaningEn: "partMeaningEn",
  meaningVi: "partMeaningVi",
  example: "partExample",
  synonyms: "partSynonyms",
  antonyms: "partAntonyms",
  note: "partNote",
};

function inAnyGroup(w: EnglishWord, groupIds: Set<number>) {
  return w.groupIds.some((g) => groupIds.has(g));
}

function scopeWords(words: EnglishWord[], s: ListenSettings): EnglishWord[] {
  return sortWords(pickScope(words, s), s.order.sortField, s.order.sortDir);
}

function pickScope(words: EnglishWord[], s: ListenSettings): EnglishWord[] {
  switch (s.scopeMode) {
    case "groups": {
      const set = new Set(s.groupIds);
      return words.filter((w) => inAnyGroup(w, set));
    }
    case "groupWords": {
      const groupSet = new Set(s.gwGroupIds);
      const wordSet = new Set(s.gwExtraWordIds);
      return words.filter((w) => wordSet.has(w.id) || inAnyGroup(w, groupSet));
    }
    case "words": {
      const set = new Set(s.wordIds);
      return words.filter((w) => set.has(w.id));
    }
  }
}

export function ListenTab() {
  const t = useTranslations("English");
  const { words, groups, loaded } = useEnglishStudy();
  const { settings, update } = useListenSettings();

  // Only scope and order affect the queue — other settings (speed, pauses…) must not rebuild it.
  const { scopeMode, groupIds, gwGroupIds, gwExtraWordIds, wordIds, order } = settings;
  const queueWords = useMemo(
    () => scopeWords(words, { ...DEFAULT_LISTEN_SETTINGS, scopeMode, groupIds, gwGroupIds, gwExtraWordIds, wordIds, order }),
    [words, scopeMode, groupIds, gwGroupIds, gwExtraWordIds, wordIds, order]
  );
  const locale = useLocale();
  const leadLang: LeadLang = settings.leadLang === "site" ? (locale.startsWith("vi") ? "vi" : "en") : settings.leadLang;
  const leads = useMemo(() => leadIns(leadLang), [leadLang]);
  const piper = usePiperStore();
  const viPiper = isPiperVoice(settings.viVoice) && piper.stored.includes(settings.viVoice) ? settings.viVoice : null;
  const viBrowserVoice = settings.viVoice.startsWith(BROWSER_VOICE_PREFIX) ? settings.viVoice.slice(BROWSER_VOICE_PREFIX.length) : null;
  const reader = useAutoReader(queueWords, settings, leads, viPiper, viBrowserVoice);
  const anyPart = READ_PARTS.some((p) => settings.parts[p]);

  const [viVoiceMissing, setViVoiceMissing] = useState(false);
  useEffect(() => {
    if (!speechSupported()) return;
    waitForVoices().then(() => setViVoiceMissing(!pickVoice("vi-VN")));
  }, []);

  // Space: play/pause, ←/→: previous/next word.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select, button, [contenteditable], [role=listbox], [role=dialog], [role=slider], [role=checkbox]")) return;
      if (e.key === " ") {
        if (reader.playing) reader.pause();
        else if (anyPart && reader.order.length > 0) reader.play();
      } else if (e.key === "ArrowLeft") reader.prev();
      else if (e.key === "ArrowRight") reader.next();
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (!loaded) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
        <div className="w-6 h-6 border-2 border-border border-t-foreground rounded-full animate-spin" />
        <p className="text-sm">{t("Common.loadingData")}</p>
      </div>
    );
  }

  const needsVi = settings.parts.meaningVi || settings.parts.note || (settings.leadIns && leadLang === "vi");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
      {/* Player */}
      <div className="lg:col-span-3 lg:order-last space-y-4 lg:sticky lg:top-20">
        {!speechSupported() && <Warning text={t("Listen.noSpeech")} />}
        {speechSupported() && needsVi && viVoiceMissing && !viPiper && <Warning text={t("Listen.noViVoice")} />}

        {reader.order.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
            {t("Listen.emptyQueue")}
          </div>
        ) : (
          <>
            <FlashcardProgress index={reader.index} total={reader.order.length} />
            {reader.current && <NowReading word={reader.current} parts={settings.parts} active={reader.active} />}

            <div className="flex items-center justify-center gap-2">
              <ToggleIcon on={settings.shuffle} onClick={() => update({ shuffle: !settings.shuffle })} title={t("Listen.shuffle")}>
                <Shuffle className="w-4 h-4" />
              </ToggleIcon>
              <Button variant="outline" size="icon" onClick={reader.prev} title={t("Listen.prevWord")}>
                <SkipBack className="w-4 h-4" />
              </Button>
              <Button
                size="lg"
                className="rounded-full w-14 h-14"
                onClick={reader.playing ? reader.pause : reader.play}
                disabled={!reader.playing && !anyPart}
                title={reader.playing ? t("Listen.pause") : t("Listen.play")}
              >
                {reader.playing ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
              </Button>
              <Button variant="outline" size="icon" onClick={reader.next} title={t("Listen.nextWord")}>
                <SkipForward className="w-4 h-4" />
              </Button>
              <ToggleIcon on={settings.loop} onClick={() => update({ loop: !settings.loop })} title={t("Listen.loop")}>
                <Repeat className="w-4 h-4" />
              </ToggleIcon>
            </div>
            {!anyPart && <p className="text-center text-xs text-destructive">{t("Listen.noPartSelected")}</p>}

            <QueueList order={reader.order} index={reader.index} onJump={reader.jump} />
          </>
        )}
      </div>

      {/* Configuration */}
      <ConfigPanel
        settings={settings}
        update={update}
        words={words}
        groups={groups}
        queueCount={queueWords.length}
        piperStored={piper.stored}
        piperRefresh={piper.refresh}
      />
    </div>
  );
}


// The settings column. Memoised so the reader's frequent state changes (current
// word, part being read…) don't re-render the word pickers and other controls.
const ConfigPanel = memo(function ConfigPanel({
  settings,
  update,
  words,
  groups,
  queueCount,
  piperStored,
  piperRefresh,
}: {
  settings: ListenSettings;
  update: (patch: Partial<ListenSettings>) => void;
  words: EnglishWord[];
  groups: EnglishGroup[];
  queueCount: number;
  piperStored: string[];
  piperRefresh: () => Promise<void>;
}) {
  const t = useTranslations("English");
  return (
    <div className="lg:col-span-2 space-y-4">
      <Section title={t("Listen.scope")}>
        <div className="grid grid-cols-3 gap-1 rounded-md border border-border p-0.5">
          {SCOPE_MODES.map((m) => (
            <Button
              key={m}
              size="sm"
              variant={settings.scopeMode === m ? "default" : "ghost"}
              className="h-8"
              onClick={() => update({ scopeMode: m })}
            >
              {t(`Listen.mode_${m}`)}
            </Button>
          ))}
        </div>
        <ScopeEditor settings={settings} update={update} words={words} groups={groups} />
        <p className="text-xs text-muted-foreground">{t("Listen.wordCount", { count: queueCount })}</p>
      </Section>

      <Section title={t("Listen.order")}>
        <div className="grid grid-cols-2 gap-2">
          <Select
            value={settings.order.sortField}
            onValueChange={(v) => update({ order: { ...settings.order, sortField: v as SortField } })}
            disabled={settings.shuffle}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alphabet">{t("Words.sortAlphabet")}</SelectItem>
              <SelectItem value="wordType">{t("Words.sortWordType")}</SelectItem>
              <SelectItem value="frequency">{t("Words.sortFrequency")}</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={settings.order.sortDir}
            onValueChange={(v) => update({ order: { ...settings.order, sortDir: v as SortDir } })}
            disabled={settings.shuffle}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">{t("Words.sortAsc")}</SelectItem>
              <SelectItem value="desc">{t("Words.sortDesc")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={settings.shuffle} onCheckedChange={(v) => update({ shuffle: v === true })} />
          {t("Listen.shuffle")}
        </label>
        {settings.shuffle && <p className="text-xs text-muted-foreground">{t("Listen.orderShuffleHint")}</p>}
      </Section>

      <Section title={t("Listen.readInfo")}>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          {READ_PARTS.filter((p) => p !== "spelling").map((p) => (
            <label key={p} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={settings.parts[p]}
                onCheckedChange={(v) => update({ parts: { ...settings.parts, [p]: v === true } })}
              />
              {t(`Listen.${PART_LABEL_KEY[p]}`)}
            </label>
          ))}
        </div>
      </Section>

      <Section title={t("Listen.viVoice")}>
        <ViVoiceSection
          value={settings.viVoice}
          onChange={(v) => update({ viVoice: v })}
          stored={piperStored}
          refresh={piperRefresh}
          rate={settings.rate}
        />
      </Section>

      <Section title={t("Listen.settings")}>
        <div className="space-y-1">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={settings.parts.spelling}
              onCheckedChange={(v) => update({ parts: { ...settings.parts, spelling: v === true } })}
            />
            {t("Listen.spellingOption")}
          </label>
          <p className="text-xs text-muted-foreground pl-6">{t("Listen.spellingHint")}</p>
        </div>
        <div className="space-y-1">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={settings.leadIns} onCheckedChange={(v) => update({ leadIns: v === true })} />
            {t("Listen.leadIns")}
          </label>
          <p className="text-xs text-muted-foreground pl-6">{t("Listen.leadInsHint")}</p>
          {settings.leadIns && (
            <div className="pl-6 pt-1">
              <Select value={settings.leadLang} onValueChange={(v) => update({ leadLang: v as ListenSettings["leadLang"] })}>
                <SelectTrigger className="h-8 w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="site">{t("Listen.leadLangSite")}</SelectItem>
                  <SelectItem value="vi">{t("Listen.leadLangVi")}</SelectItem>
                  <SelectItem value="en">{t("Listen.leadLangEn")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm">{t("Listen.wordRepeat")}</span>
          <Select value={String(settings.wordRepeat)} onValueChange={(v) => update({ wordRepeat: Number(v) })}>
            <SelectTrigger className="w-20 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3].map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <SliderRow
          label={t("Listen.rate")}
          value={settings.rate}
          min={0.5}
          max={1.5}
          step={0.1}
          format={(v) => `${v.toFixed(1)}x`}
          onChange={(v) => update({ rate: v })}
        />
        <SliderRow
          label={t("Listen.partGap")}
          value={settings.partGapMs / 1000}
          min={0}
          max={3}
          step={0.1}
          format={(v) => t("Listen.seconds", { value: v.toFixed(1) })}
          onChange={(v) => update({ partGapMs: Math.round(v * 1000) })}
        />
        <SliderRow
          label={t("Listen.wordGap")}
          value={settings.wordGapMs / 1000}
          min={0.3}
          max={5}
          step={0.1}
          format={(v) => t("Listen.seconds", { value: v.toFixed(1) })}
          onChange={(v) => update({ wordGapMs: Math.round(v * 1000) })}
        />
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={settings.loop} onCheckedChange={(v) => update({ loop: v === true })} />
          {t("Listen.loop")}
        </label>
      </Section>
    </div>
  );
});

function ScopeEditor({
  settings,
  update,
  words,
  groups,
}: {
  settings: ListenSettings;
  update: (patch: Partial<ListenSettings>) => void;
  words: EnglishWord[];
  groups: EnglishGroup[];
}) {
  const t = useTranslations("English");

  if (settings.scopeMode === "groups") {
    return (
      <GroupChips
        groups={groups}
        selected={settings.groupIds}
        onToggle={(id, on) =>
          update({ groupIds: on ? [...settings.groupIds, id] : settings.groupIds.filter((g) => g !== id) })
        }
      />
    );
  }

  if (settings.scopeMode === "groupWords") {
    // Words of the picked groups are always read; the checklist adds extra words from anywhere.
    const groupSet = new Set(settings.gwGroupIds);
    const lockedIds = new Set(words.filter((w) => inAnyGroup(w, groupSet)).map((w) => w.id));
    return (
      <div className="space-y-3">
        <GroupChips
          groups={groups}
          selected={settings.gwGroupIds}
          onToggle={(id, on) =>
            update({ gwGroupIds: on ? [...settings.gwGroupIds, id] : settings.gwGroupIds.filter((g) => g !== id) })
          }
        />
        <p className="text-xs text-muted-foreground">{t("Listen.extraWordsHint")}</p>
        <WordChecklist
          words={words}
          selected={settings.gwExtraWordIds}
          lockedIds={lockedIds}
          onChange={(ids) => update({ gwExtraWordIds: ids })}
        />
      </div>
    );
  }

  return <WordChecklist words={words} selected={settings.wordIds} onChange={(ids) => update({ wordIds: ids })} />;
}

function GroupChips({
  groups,
  selected,
  onToggle,
}: {
  groups: EnglishGroup[];
  selected: number[];
  onToggle: (id: number, on: boolean) => void;
}) {
  const t = useTranslations("English");
  if (groups.length === 0) return <p className="text-xs text-muted-foreground">{t("Listen.noGroups")}</p>;
  return (
    <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
      {groups.map((g) => {
        const on = selected.includes(g.id);
        return (
          <button
            key={g.id}
            type="button"
            onClick={() => onToggle(g.id, !on)}
            className={cn(
              "px-2.5 py-1 rounded-full border text-xs transition-colors",
              on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {g.name} <span className="opacity-60">({g.wordIds.length})</span>
          </button>
        );
      })}
    </div>
  );
}

// Memoised: picking words or changing other settings must not re-render the card or the (long) queue.
const NowReading = memo(function NowReading({ word, parts, active }: { word: EnglishWord; parts: ListenSettings["parts"]; active: ActiveSegment | null }) {
  const t = useTranslations("English");
  const isActive = (part: ReadPart, senseIndex?: number) =>
    active?.wordId === word.id && active.part === part && active.senseIndex === senseIndex;
  const hl = (part: ReadPart, senseIndex?: number) =>
    cn(
      "rounded px-1.5 -mx-1.5 transition-colors",
      isActive(part, senseIndex) && "bg-primary/15 text-foreground",
      !parts[part] && "opacity-50"
    );
  const first = word.senses[0];

  return (
    <div className="rounded-2xl border border-border p-5 sm:p-6 shadow-sm space-y-4 max-h-[50dvh] overflow-y-auto">
      <div className="text-center space-y-1">
        <span className={cn("inline-block text-3xl sm:text-4xl font-semibold", hl("word"))}>{word.word}</span>
        {first?.phonetic && <p className="text-sm text-muted-foreground">/{first.phonetic}/</p>}
        {parts.spelling && (
          <p className={cn("text-sm tracking-widest text-muted-foreground", hl("spelling"))}>{spellOut(word.word)}</p>
        )}
      </div>
      {word.senses.length === 0 ? (
        <p className="text-sm text-muted-foreground italic text-center">{t("Words.noSenses")}</p>
      ) : (
        word.senses.map((s, i) => (
          <div key={i} className={cn("space-y-1", i > 0 && "border-t border-border pt-3")}>
            {s.partOfSpeech && (
              <span className={cn("inline-block text-[10px] font-medium uppercase text-muted-foreground", hl("partOfSpeech", i))}>
                {s.partOfSpeech}
              </span>
            )}
            {s.cambridgeMeaning && <p className={cn("text-sm italic text-muted-foreground", hl("meaningEn", i))}>{s.cambridgeMeaning}</p>}
            {s.meaningVi && <p className={cn("text-sm font-medium", hl("meaningVi", i))}>{s.meaningVi}</p>}
            {s.example && <p className={cn("text-sm text-muted-foreground", hl("example", i))}>&quot;{s.example}&quot;</p>}
            {s.synonyms && parts.synonyms && (
              <p className={cn("text-xs", hl("synonyms", i))}>{t("Common.synonyms")} {s.synonyms}</p>
            )}
            {s.antonyms && parts.antonyms && (
              <p className={cn("text-xs", hl("antonyms", i))}>{t("Common.antonyms")} {s.antonyms}</p>
            )}
            {s.note && parts.note && (
              <p className={cn("text-xs whitespace-pre-line", hl("note", i))}>{s.note}</p>
            )}
          </div>
        ))
      )}
    </div>
  );
});

const QueueList = memo(function QueueList({ order, index, onJump }: { order: EnglishWord[]; index: number; onJump: (i: number) => void }) {
  const t = useTranslations("English");
  const boxRef = useRef<HTMLDivElement | null>(null);

  // Keep the current word visible inside the list without scrolling the page.
  useEffect(() => {
    const box = boxRef.current;
    const item = box?.querySelector<HTMLElement>(`[data-idx="${index}"]`);
    if (!box || !item) return;
    const top = item.offsetTop - box.offsetTop;
    if (top < box.scrollTop || top + item.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTop = top - box.clientHeight / 2 + item.offsetHeight / 2;
    }
  }, [index, order]);

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{t("Listen.queue")}</p>
      <div ref={boxRef} className="relative max-h-48 overflow-y-auto rounded-md border border-border">
        {order.map((w, i) => (
          <button
            key={w.id}
            type="button"
            data-idx={i}
            onClick={() => onJump(i)}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted/50 [content-visibility:auto] [contain-intrinsic-size:auto_32px]",
              i === index && "bg-primary/10 text-primary font-medium"
            )}
          >
            <span className="w-8 shrink-0 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
            <span className="truncate">{w.word}</span>
          </button>
        ))}
      </div>
    </div>
  );
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border p-4 space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  // While dragging only this row re-renders; the setting is saved on release,
  // so the whole tab (word lists, queue, storage) doesn't update on every tick.
  const [draft, setDraft] = useState<number | null>(null);
  const shown = draft ?? value;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{format(shown)}</span>
      </div>
      <Slider
        value={[shown]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => setDraft(v)}
        onValueCommit={([v]) => {
          setDraft(null);
          onChange(v);
        }}
      />
    </div>
  );
}

function ToggleIcon({ on, onClick, title, children }: { on: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={on}
      className={cn(
        "h-9 w-9 flex items-center justify-center rounded-md border transition-colors",
        on ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function Warning({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}
