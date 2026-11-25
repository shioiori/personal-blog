"use client";

import { useEffect, useState } from "react";

export function useIncrementalList<T>(items: T[], resetKey: unknown, pageSize = 60) {
  const [count, setCount] = useState(pageSize);
  const [sentinel, sentinelRef] = useState<HTMLDivElement | null>(null);
  const hasMore = count < items.length;

  useEffect(() => {
    setCount(pageSize);
  }, [resetKey, pageSize]);

  useEffect(() => {
    if (!sentinel || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setCount((c) => c + pageSize);
      },
      { rootMargin: "400px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel, hasMore, count, pageSize]);

  return { visible: hasMore ? items.slice(0, count) : items, sentinelRef, hasMore };
}
