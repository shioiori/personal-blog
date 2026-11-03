"use client";

import { useState, useCallback, useEffect } from "react";

export interface FlashcardSettings {
  maxReviews: number; // 0 = unlimited
  order: "due" | "random";
  autoPronounce: boolean;
}

const DEFAULT_SETTINGS: FlashcardSettings = { maxReviews: 20, order: "due", autoPronounce: false };
const STORAGE_KEY = "english-flashcard-settings";
const API_URL = "/api/english/flashcard/settings";

export function useFlashcardSettings() {
  const [settings, setSettings] = useState<FlashcardSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<FlashcardSettings>) });
    } catch {
      // ignore
    }
    fetch(API_URL)
      .then((res) => (res.ok ? (res.json() as Promise<{ value: Partial<FlashcardSettings> | null }>) : null))
      .then((data) => {
        if (cancelled || !data?.value) return;
        const next = { ...DEFAULT_SETTINGS, ...data.value };
        setSettings(next);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateSettings = useCallback((patch: Partial<FlashcardSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      fetch(API_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: next }),
      }).catch(() => {});
      return next;
    });
  }, []);

  return { settings, updateSettings, loaded };
}
