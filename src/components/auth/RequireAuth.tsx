"use client";

import { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { LogIn } from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import { Loading } from "@/src/components/ui/Loading";
import { useAuth } from "@/src/context/auth";

export function RequireAuth({ children }: { children: ReactNode }) {
  const t = useTranslations("Auth");
  const { user, loading, openLogin } = useAuth();

  if (loading) return <Loading className="h-64 w-full" />;

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center text-muted-foreground">
        <p>{t("required")}</p>
        <Button onClick={openLogin}>
          <LogIn className="h-4 w-4" />
          {t("submit")}
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
