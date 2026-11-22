"use client";

import { createContext, useContext, useState, useCallback } from "react";

export interface LookupHistoryEntry {
  id: string;
  query: string;
  result: string;
  explanation: string;
}

interface EnglishLookupContextValue {
  isFloatingVisible: boolean;
  setIsFloatingVisible: (v: boolean) => void;
  isBoxExpanded: boolean;
  setIsBoxExpanded: (v: boolean) => void;
  explainMode: boolean;
  setExplainMode: (v: boolean) => void;
  history: LookupHistoryEntry[];
  isLoading: boolean;
  lookup: (query: string) => Promise<void>;
  clearHistory: () => void;
}

const EnglishLookupContext = createContext<EnglishLookupContextValue | null>(null);

export function EnglishLookupProvider({ children }: { children: React.ReactNode }) {
  const [isFloatingVisible, setIsFloatingVisible] = useState(true);
  const [isBoxExpanded, setIsBoxExpanded] = useState(false);
  const [explainMode, setExplainMode] = useState(false);
  const [history, setHistory] = useState<LookupHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const lookup = useCallback(
    async (query: string) => {
      const trimmed = query.trim();
      if (!trimmed) return;
      setIsLoading(true);
      try {
        const res = await fetch("/api/english/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: trimmed, explain: explainMode }),
        });
        const data = (await res.json()) as { result?: string; explanation?: string; needsPremium?: boolean; error?: string };
        if (!res.ok) {
          setHistory((prev) => [
            {
              id: crypto.randomUUID(),
              query: trimmed,
              result: data.needsPremium ? "Tính năng này cần tài khoản Premium." : "Không tra được, thử lại sau.",
              explanation: "",
            },
            ...prev,
          ]);
          return;
        }
        setHistory((prev) => [
          { id: crypto.randomUUID(), query: trimmed, result: data.result ?? "", explanation: data.explanation ?? "" },
          ...prev,
        ]);
      } catch {
        setHistory((prev) => [
          { id: crypto.randomUUID(), query: trimmed, result: "Không tra được, thử lại sau.", explanation: "" },
          ...prev,
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [explainMode],
  );

  const clearHistory = useCallback(() => setHistory([]), []);

  return (
    <EnglishLookupContext.Provider
      value={{
        isFloatingVisible,
        setIsFloatingVisible,
        isBoxExpanded,
        setIsBoxExpanded,
        explainMode,
        setExplainMode,
        history,
        isLoading,
        lookup,
        clearHistory,
      }}
    >
      {children}
    </EnglishLookupContext.Provider>
  );
}

export function useEnglishLookup() {
  const ctx = useContext(EnglishLookupContext);
  if (!ctx) throw new Error("useEnglishLookup must be used within EnglishLookupProvider");
  return ctx;
}
