"use client";

import { useCallback, useEffect, useState } from "react";
import type { WordFilter } from "../shared/wordFilter";

export type ScopeMode = "filter" | "groups" | "groupWords" | "words";

/** Pieces of a word that can be read, in reading order. */
export const READ_PARTS = [
  "word",
  "partOfSpeech",
  "meaningEn",
  "meaningVi",
  "example",
  "synonyms",
  "antonyms",
  "note",
] as const;
export type ReadPart = (typeof READ_PARTS)[number];

export interface ListenSettings {
  scopeMode: ScopeMode;
  filter: WordFilter;
  /** Groups picked in "groups" mode. */
  groupIds: number[];
  /** Groups picked in "groupWords" mode, and the words ticked inside them. */
  gwGroupIds: number[];
  gwWordIds: number[];
  /** Words picked in "words" mode. */
  wordIds: number[];
  parts: Record<ReadPart, boolean>;
  wordRepeat: number;
  rate: number;
  partGapMs: number;
  wordGapMs: number;
  loop: boolean;
  shuffle: boolean;
}

export const DEFAULT_LISTEN_SETTINGS: ListenSettings = {
  scopeMode: "filter",
  filter: { search: "", group: "all", sortField: "alphabet", sortDir: "asc" },
  groupIds: [],
  gwGroupIds: [],
  gwWordIds: [],
  wordIds: [],
  parts: {
    word: true,
    partOfSpeech: false,
    meaningEn: true,
    meaningVi: true,
    example: true,
    synonyms: false,
    antonyms: false,
    note: false,
  },
  wordRepeat: 1,
  rate: 0.9,
  partGapMs: 500,
  wordGapMs: 1500,
  loop: false,
  shuffle: false,
};

const STORAGE_KEY = "english-listen-settings";

function load(): ListenSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LISTEN_SETTINGS;
    const stored = JSON.parse(raw) as Partial<ListenSettings>;
    return {
      ...DEFAULT_LISTEN_SETTINGS,
      ...stored,
      filter: { ...DEFAULT_LISTEN_SETTINGS.filter, ...stored.filter },
      parts: { ...DEFAULT_LISTEN_SETTINGS.parts, ...stored.parts },
    };
  } catch {
    return DEFAULT_LISTEN_SETTINGS;
  }
}

export function useListenSettings() {
  const [settings, setSettings] = useState<ListenSettings>(DEFAULT_LISTEN_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSettings(load());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore (private mode, quota)
    }
  }, [settings, hydrated]);

  const update = useCallback((patch: Partial<ListenSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  return { settings, update, hydrated };
}
