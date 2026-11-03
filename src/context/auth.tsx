"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { LoginDialog } from "../components/auth/LoginDialog";

export interface AuthUser {
  id: number;
  email: string;
}

export type LoginResult = "ok" | "invalid" | "error";

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  openLogin: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data: { user: AuthUser | null }) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      if (res.status === 401) return "invalid";
      if (!res.ok) return "error";
      const data = (await res.json()) as { user: AuthUser };
      setUser(data.user);
      setLoginOpen(false);
      return "ok";
    } catch {
      return "error";
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
  }, []);

  const openLogin = useCallback(() => setLoginOpen(true), []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, openLogin }}>
      {children}
      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} onLogin={login} />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
