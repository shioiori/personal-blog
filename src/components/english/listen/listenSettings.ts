"use client";

import { useCallback, useEffect, useState } from "react";
import type { SortDir, SortField } from "../shared/wordFilter";
import { isPiperVoice } from "./piperVoice";

export type ScopeMode = "groups" | "groupWords" | "words";
const SCOPE_MODES: ScopeMode[] = ["groups", "groupWords", "words"];

/** Pieces of a word that can be read, in reading order. */
export const READ_PARTS = [
  "word",
  "spelling",
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
  /** Reading order (same options as the Study tab sort); ignored while shuffle is on. */
  order: { sortField: SortField; sortDir: SortDir };
  /** Groups picked in "groups" mode. */
  groupIds: number[];
  /** "groupWords" mode: every word of these groups, plus extra words picked from anywhere. */
  gwGroupIds: number[];
  gwExtraWordIds: number[];
  /** Words picked in "words" mode. */
  wordIds: number[];
  parts: Record<ReadPart, boolean>;
  /** Speak a short lead-in ("English meaning:", "Example:"…) in the site language before each part. */
  leadIns: boolean;
  /** Language of the lead-ins: follow the site, or always Vietnamese / English. */
  leadLang: "site" | "vi" | "en";
  /**
   * Voice for Vietnamese text: "browser" (automatic pick), "browser:<voice name>"
   * (a specific installed voice), or a Piper voice id (used once downloaded).
   */
  viVoice: string;
  wordRepeat: number;
  rate: number;
  partGapMs: number;
  wordGapMs: number;
  loop: boolean;
  shuffle: boolean;
}

export const DEFAULT_LISTEN_SETTINGS: ListenSettings = {
  scopeMode: "groups",
  order: { sortField: "alphabet", sortDir: "asc" },
  groupIds: [],
  gwGroupIds: [],
  gwExtraWordIds: [],
  wordIds: [],
  parts: {
    word: true,
    spelling: false,
    partOfSpeech: false,
    meaningEn: true,
    meaningVi: true,
    example: true,
    synonyms: false,
    antonyms: false,
    note: false,
  },
  leadIns: true,
  leadLang: "site",
  viVoice: "vi_VN-vais1000-medium",
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
    const stored = JSON.parse(raw) as Partial<ListenSettings> & {
      filter?: Partial<ListenSettings["order"]>; // older versions kept the order inside a "filter" scope
      gwWordIds?: number[]; // older "group + words" kept only words inside the groups; dropped
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { filter: legacyFilter, gwWordIds: _legacyGwWords, ...rest } = stored;
    return {
      ...DEFAULT_LISTEN_SETTINGS,
      ...rest,
      scopeMode: SCOPE_MODES.includes(rest.scopeMode as ScopeMode) ? (rest.scopeMode as ScopeMode) : DEFAULT_LISTEN_SETTINGS.scopeMode,
      order: {
        ...DEFAULT_LISTEN_SETTINGS.order,
        ...(legacyFilter?.sortField ? { sortField: legacyFilter.sortField } : {}),
        ...(legacyFilter?.sortDir ? { sortDir: legacyFilter.sortDir } : {}),
        ...rest.order,
      },
      parts: { ...DEFAULT_LISTEN_SETTINGS.parts, ...stored.parts },
      // A Piper voice that's no longer offered (dropped as incompatible) falls back to the default.
      viVoice:
        typeof rest.viVoice === "string" && (rest.viVoice === "browser" || rest.viVoice.startsWith("browser:") || isPiperVoice(rest.viVoice))
          ? rest.viVoice
          : DEFAULT_LISTEN_SETTINGS.viVoice,
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
