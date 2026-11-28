"use client";

import { useState, useCallback, useEffect } from "react";

export interface WritingSettings {
  maxReviews: number; // 0 = unlimited
  order: "due" | "random";
  inputMode: "type" | "voice";
}

const DEFAULT_SETTINGS: WritingSettings = { maxReviews: 20, order: "due", inputMode: "type" };
const STORAGE_KEY = "english-writing-settings";
const API_URL = "/api/english/writing/settings";

export function useWritingSettings() {
  const [settings, setSettings] = useState<WritingSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setSettings({ ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<WritingSettings>) });
        setLoaded(true);
      }
    } catch {
      // ignore
    }
    fetch(API_URL)
      .then((res) => (res.ok ? (res.json() as Promise<{ value: Partial<WritingSettings> | null }>) : null))
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

  const updateSettings = useCallback((patch: Partial<WritingSettings>) => {
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
