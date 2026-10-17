"use client";

import { useEffect, useRef, useState } from "react";

/** Ids whose signature changed since the last render, held for `ms` so a row can flash. First sight never flashes. */
export function useFlash(items: { id: string; sig: string }[], ms = 1800): Set<string> {
  const seen = useRef(new Map<string, string>());
  const [flashing, setFlashing] = useState<Set<string>>(() => new Set());
  const key = items.map((i) => `${i.id}:${i.sig}`).join("|");

  useEffect(() => {
    const hits: string[] = [];
    for (const i of items) {
      const before = seen.current.get(i.id);
      if (before !== undefined && before !== i.sig) hits.push(i.id);
      seen.current.set(i.id, i.sig);
    }
    if (hits.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFlashing(new Set(hits));
    const t = setTimeout(() => setFlashing(new Set()), ms);
    return () => clearTimeout(t);
    // `key` captures every id and signature, so `items` itself can be a fresh array each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ms]);

  return flashing;
}
