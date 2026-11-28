"use client";

import { useEffect, useRef, useState } from "react";

export function usePagedList<T>(items: T[], resetKey: unknown, pageSize: number) {
  const [page, setPage] = useState(1);
  const listRef = useRef<HTMLDivElement | null>(null);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  function goTo(next: number) {
    setPage(next);
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = 0;
    if (el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  return { visible: items.slice((page - 1) * pageSize, page * pageSize), page, pageCount, goTo, listRef };
}
