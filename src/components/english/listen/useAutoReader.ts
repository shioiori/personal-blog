"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EnglishWord } from "@/src/declaration/english";
import { getCrawlAudioUrl } from "../study/crawlData";
import type { ListenSettings, ReadPart } from "./listenSettings";
import { abortable, isAbortError, playAudio, sleep, speak, waitForVoices } from "./speechEngine";
import { synthesize, type PiperVoiceId } from "./piperVoice";
import type { LeadIns } from "./leadPhrases";

export interface Segment {
  part: ReadPart;
  /** Sense the segment belongs to; undefined for the headword. */
  senseIndex?: number;
  text: string;
  lang: string;
  audioUrl?: string;
  /** Spoken lead-in before the part, e.g. "Example:". */
  lead?: { text: string; lang: string };
}

/** "embassy" → "E, M, B, A, S, S, Y" (upper case so engines say the letter, not the article "a"). */
export function spellOut(word: string): string {
  return word
    .split(/\s+/)
    .map((part) => [...part].filter((c) => /\p{L}|\p{N}/u.test(c)).map((c) => c.toUpperCase()).join(", "))
    .filter(Boolean)
    .join(". ");
}

const SENSE_PARTS: { part: ReadPart; field: "partOfSpeech" | "cambridgeMeaning" | "meaningVi" | "example" | "synonyms" | "antonyms" | "note"; lang: string }[] = [
  { part: "partOfSpeech", field: "partOfSpeech", lang: "en-US" },
  { part: "meaningEn", field: "cambridgeMeaning", lang: "en-US" },
  { part: "meaningVi", field: "meaningVi", lang: "vi-VN" },
  { part: "example", field: "example", lang: "en-US" },
  { part: "synonyms", field: "synonyms", lang: "en-US" },
  { part: "antonyms", field: "antonyms", lang: "en-US" },
  { part: "note", field: "note", lang: "vi-VN" },
];

export function buildSegments(word: EnglishWord, settings: ListenSettings, leads?: LeadIns | null): Segment[] {
  const segs: Segment[] = [];
  const useLeads = settings.leadIns && !!leads;
  const leadFor = (part: ReadPart, heading?: string) => {
    if (!useLeads || !leads) return undefined;
    const text = [heading, leads.part(part)].filter(Boolean).join(". ");
    return text ? { text, lang: leads.lang } : undefined;
  };
  // With several meanings, each one starts with "Nghĩa thứ nhất…" / "First meaning…".
  const numberSenses = useLeads && word.senses.length >= 2;
  if (settings.parts.word) {
    const audioUrl = getCrawlAudioUrl(word);
    for (let r = 0; r < settings.wordRepeat; r++) segs.push({ part: "word", text: word.word, lang: "en-US", audioUrl });
  }
  if (settings.parts.spelling) {
    const text = spellOut(word.word);
    if (text) segs.push({ part: "spelling", text, lang: "en-US", lead: leadFor("spelling") });
  }
  word.senses.forEach((sense, senseIndex) => {
    let heading = numberSenses ? leads!.senseHeading(senseIndex + 1) : undefined;
    for (const { part, field, lang } of SENSE_PARTS) {
      if (!settings.parts[part]) continue;
      const text = sense[field]?.trim();
      if (!text) continue;
      segs.push({ part, senseIndex, text, lang, lead: leadFor(part, heading) });
      heading = undefined; // only before the first part read for this meaning
    }
  });
  return segs;
}

function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface ActiveSegment {
  wordId: number;
  part: ReadPart;
  senseIndex?: number;
}

const isVi = (lang: string) => lang.toLowerCase().startsWith("vi");

/** Vietnamese texts of a word's segments (lead-ins included), for prefetching Piper audio. */
function viTexts(segs: Segment[]): string[] {
  const out: string[] = [];
  for (const s of segs) {
    if (s.lead && isVi(s.lead.lang)) out.push(s.lead.text);
    if (isVi(s.lang)) out.push(s.text);
  }
  return out;
}

/**
 * @param viPiper Piper voice used for Vietnamese text (null → the browser's own voice).
 * @param viBrowserVoice installed browser voice to use for Vietnamese text (null → automatic pick).
 */
export function useAutoReader(
  words: EnglishWord[],
  settings: ListenSettings,
  leads?: LeadIns | null,
  viPiper?: PiperVoiceId | null,
  viBrowserVoice?: string | null
) {
  const idsKey = useMemo(() => words.map((w) => w.id).join(","), [words]);
  const [order, setOrder] = useState<EnglishWord[]>(words);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [active, setActive] = useState<ActiveSegment | null>(null);

  const ctrlRef = useRef<AbortController | null>(null);
  const orderRef = useRef(order);
  orderRef.current = order;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const wordsRef = useRef(words);
  const leadsRef = useRef(leads);
  leadsRef.current = leads;
  const viPiperRef = useRef(viPiper);
  viPiperRef.current = viPiper;
  const viBrowserVoiceRef = useRef(viBrowserVoice);
  viBrowserVoiceRef.current = viBrowserVoice;
  wordsRef.current = words;

  const stop = useCallback(() => {
    ctrlRef.current?.abort();
    ctrlRef.current = null;
    setPlaying(false);
    setActive(null);
  }, []);

  // Scope or shuffle changed → rebuild the queue from the start.
  useEffect(() => {
    stop();
    setIndex(0);
    setOrder(settings.shuffle ? shuffled(wordsRef.current) : wordsRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, settings.shuffle]);

  // Same ids but fresh data (e.g. a refetch after an edit) → swap in the new objects, keep the order.
  useEffect(() => {
    const byId = new Map(words.map((w) => [w.id, w]));
    setOrder((prev) => prev.map((w) => byId.get(w.id) ?? w));
  }, [words]);

  useEffect(() => () => ctrlRef.current?.abort(), []);

  // Vietnamese goes through Piper when a voice is ready; anything else (or a Piper failure) uses the browser voice.
  const say = useCallback(async (text: string, lang: string, rate: number, signal: AbortSignal) => {
    const voice = viPiperRef.current;
    if (voice && isVi(lang)) {
      try {
        const url = await abortable(synthesize(text, voice), signal);
        if (await playAudio(url, signal, rate)) return;
      } catch (e) {
        if (isAbortError(e)) throw e;
        console.warn("Piper synthesis failed, using the browser voice", e);
      }
    }
    await speak(text, lang, rate, signal, isVi(lang) ? viBrowserVoiceRef.current : null);
  }, []);

  const prefetch = useCallback((segs: Segment[]) => {
    const voice = viPiperRef.current;
    if (!voice) return;
    for (const text of viTexts(segs)) synthesize(text, voice).catch(() => {});
  }, []);

  // Warm up while idle: loading the Piper model takes several seconds, so do it
  // (and prepare the Vietnamese parts of the word on screen) before Play is pressed.
  const idleWord = playing ? null : order[Math.min(index, order.length - 1)];
  useEffect(() => {
    if (!viPiper || !idleWord) return;
    // Piper runs on the main thread, so wait until the user stops picking words / changing settings.
    const timer = setTimeout(() => prefetch(buildSegments(idleWord, settingsRef.current, leadsRef.current)), 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viPiper, idleWord?.id, leads, settings.parts, settings.leadIns, prefetch]);

  const run = useCallback(async (start: number) => {
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    const { signal } = ctrl;
    setPlaying(true);
    let i = start;
    try {
      await waitForVoices();
      while (true) {
        let queue = orderRef.current;
        if (queue.length === 0) break;
        if (i >= queue.length) {
          if (!settingsRef.current.loop) break;
          i = 0;
          if (settingsRef.current.shuffle) {
            queue = shuffled(wordsRef.current);
            orderRef.current = queue;
            setOrder(queue);
          }
        }
        const word = queue[i];
        setIndex(i);
        const segs = buildSegments(word, settingsRef.current, leadsRef.current);
        prefetch(segs);
        const upcoming = queue[i + 1];
        if (upcoming) prefetch(buildSegments(upcoming, settingsRef.current, leadsRef.current));
        for (let s = 0; s < segs.length; s++) {
          const seg = segs[s];
          const cfg = settingsRef.current;
          setActive({ wordId: word.id, part: seg.part, senseIndex: seg.senseIndex });
          if (seg.lead) await say(seg.lead.text, seg.lead.lang, cfg.rate, signal);
          const played = seg.audioUrl ? await playAudio(seg.audioUrl, signal) : false;
          if (!played) await say(seg.text, seg.lang, cfg.rate, signal);
          if (s < segs.length - 1) await sleep(cfg.partGapMs, signal);
        }
        setActive(null);
        await sleep(Math.max(300, settingsRef.current.wordGapMs), signal);
        i++;
      }
      if (ctrlRef.current === ctrl) {
        ctrlRef.current = null;
        setPlaying(false);
        setActive(null);
        if (i >= orderRef.current.length) setIndex(0);
      }
    } catch (e) {
      if (!isAbortError(e)) {
        console.error(e);
        if (ctrlRef.current === ctrl) stop();
      }
    }
  }, [stop, say, prefetch]);

  const play = useCallback(() => run(index), [run, index]);

  const jump = useCallback(
    (to: number) => {
      const n = orderRef.current.length;
      if (n === 0) return;
      const target = ((to % n) + n) % n;
      setIndex(target);
      setActive(null);
      if (ctrlRef.current) run(target);
    },
    [run]
  );

  const next = useCallback(() => jump(index + 1), [jump, index]);
  const prev = useCallback(() => jump(index - 1), [jump, index]);

  const safeIndex = Math.min(index, Math.max(0, order.length - 1));
  return { order, index: safeIndex, current: order[safeIndex], playing, active, play, pause: stop, next, prev, jump };
}
