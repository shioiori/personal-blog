"use client";

import { useState } from "react";

export interface FlashcardSettings {
  maxReviews: number;
  order: "due" | "random";
  frontSide: "char" | "pinyin" | "meaning";
  showPinyinOnFront: boolean;
}

const STORAGE_KEY = "flashcard_settings";

const DEFAULT: FlashcardSettings = {
  maxReviews: 20,
  order: "due",
  frontSide: "char",
  showPinyinOnFront: false,
};

function loadSettings(): FlashcardSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT, ...JSON.parse(raw) as Partial<FlashcardSettings> };
  } catch {}
  return DEFAULT;
}

export function useFlashcardSettings() {
  const [settings, setSettings] = useState<FlashcardSettings>(loadSettings);

  function updateSettings(patch: Partial<FlashcardSettings>) {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  return { settings, updateSettings };
}
