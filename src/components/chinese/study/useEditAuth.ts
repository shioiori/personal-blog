"use client";

import { useState, useCallback } from "react";

const SESSION_KEY = "chinese_edit_auth";
const MAX_ATTEMPTS = 5;

export type AuthState =
  | { status: "idle" }
  | { status: "prompting"; attemptsLeft: number }
  | { status: "verified" }
  | { status: "locked" };

export function useEditAuth() {
  const [auth, setAuth] = useState<AuthState>(() => {
    if (typeof window === "undefined") return { status: "idle" };
    if (sessionStorage.getItem(SESSION_KEY) === "1") return { status: "verified" };
    return { status: "idle" };
  });

  // Call this when user clicks edit — returns true if already verified
  const requestEdit = useCallback((): boolean => {
    setAuth((prev) => {
      if (prev.status === "verified") return prev;
      if (prev.status === "locked") return prev;
      if (prev.status === "idle") return { status: "prompting", attemptsLeft: MAX_ATTEMPTS };
      return prev; // already prompting
    });
    return auth.status === "verified";
  }, [auth.status]);

  const submitKey = useCallback(async (key: string): Promise<"ok" | "wrong" | "locked"> => {
    const res = await fetch("/api/chinese/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    const { ok } = await res.json() as { ok: boolean };

    if (ok) {
      sessionStorage.setItem(SESSION_KEY, "1");
      setAuth({ status: "verified" });
      return "ok";
    }

    setAuth((prev) => {
      if (prev.status !== "prompting") return prev;
      const next = prev.attemptsLeft - 1;
      if (next <= 0) return { status: "locked" };
      return { status: "prompting", attemptsLeft: next };
    });
    return auth.status === "prompting" && (auth as { attemptsLeft: number }).attemptsLeft <= 1
      ? "locked"
      : "wrong";
  }, [auth]);

  const dismiss = useCallback(() => {
    setAuth((prev) => (prev.status === "prompting" ? { status: "idle" } : prev));
  }, []);

  return { auth, requestEdit, submitKey, dismiss };
}
