"use client";

import { useState, useCallback, useEffect } from "react";

export interface FlashcardSettings {
  maxReviews: number; // 0 = unlimited
  order: "due" | "random";
}

const DEFAULT_SETTINGS: FlashcardSettings = { maxReviews: 20, order: "due" };
const STORAGE_KEY = "english-flashcard-settings";

export function useFlashcardSettings() {
  const [settings, setSettings] = useState<FlashcardSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<FlashcardSettings>) });
    } catch {
      // ignore
    }
  }, []);

  const updateSettings = useCallback((patch: Partial<FlashcardSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return { settings, updateSettings };
}
