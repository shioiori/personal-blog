"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EnglishWord } from "@/src/declaration/english";
import { getCrawlAudioUrl } from "../study/crawlData";
import type { ListenSettings, ReadPart } from "./listenSettings";
import { isAbortError, playAudio, sleep, speak, waitForVoices } from "./speechEngine";

export interface Segment {
  part: ReadPart;
  /** Sense the segment belongs to; undefined for the headword. */
  senseIndex?: number;
  text: string;
  lang: string;
  audioUrl?: string;
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

export function buildSegments(word: EnglishWord, settings: ListenSettings): Segment[] {
  const segs: Segment[] = [];
  if (settings.parts.word) {
    const audioUrl = getCrawlAudioUrl(word);
    for (let r = 0; r < settings.wordRepeat; r++) segs.push({ part: "word", text: word.word, lang: "en-US", audioUrl });
  }
  word.senses.forEach((sense, senseIndex) => {
    for (const { part, field, lang } of SENSE_PARTS) {
      if (!settings.parts[part]) continue;
      const text = sense[field]?.trim();
      if (text) segs.push({ part, senseIndex, text, lang });
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

export function useAutoReader(words: EnglishWord[], settings: ListenSettings) {
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
        const segs = buildSegments(word, settingsRef.current);
        for (let s = 0; s < segs.length; s++) {
          const seg = segs[s];
          const cfg = settingsRef.current;
          setActive({ wordId: word.id, part: seg.part, senseIndex: seg.senseIndex });
          const played = seg.audioUrl ? await playAudio(seg.audioUrl, signal) : false;
          if (!played) await speak(seg.text, seg.lang, cfg.rate, signal);
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
  }, [stop]);

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
