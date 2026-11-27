"use client";

import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/src/components/ui/Button";

function pageItems(page: number, pageCount: number): (number | "gap")[] {
  const pages = [...new Set([1, page - 1, page, page + 1, pageCount])]
    .filter((p) => p >= 1 && p <= pageCount)
    .sort((a, b) => a - b);
  return pages.flatMap((p, i) => (i > 0 && p - pages[i - 1] > 1 ? ["gap" as const, p] : [p]));
}

export function Pagination({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (page: number) => void }) {
  const t = useTranslations("English.Common");
  if (pageCount <= 1) return null;

  return (
    <nav className="flex items-center justify-center gap-1 pt-2">
      <Button variant="ghost" size="icon" className="h-8 w-8" disabled={page === 1} onClick={() => onChange(page - 1)} aria-label={t("prevPage")}>
        <ChevronLeft />
      </Button>
      {pageItems(page, pageCount).map((p, i) =>
        p === "gap" ? (
          <span key={`gap-${i}`} className="px-1 text-sm text-muted-foreground">…</span>
        ) : (
          <Button
            key={p}
            variant={p === page ? "default" : "ghost"}
            size="sm"
            className="h-8 min-w-8 px-2"
            onClick={() => onChange(p)}
            aria-current={p === page ? "page" : undefined}
          >
            {p}
          </Button>
        )
      )}
      <Button variant="ghost" size="icon" className="h-8 w-8" disabled={page === pageCount} onClick={() => onChange(page + 1)} aria-label={t("nextPage")}>
        <ChevronRight />
      </Button>
    </nav>
  );
}
