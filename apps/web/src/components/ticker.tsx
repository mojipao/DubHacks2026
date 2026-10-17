"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/data/store";
import { tickerTime } from "@/lib/format";

export function EventTicker() {
  const { state } = useStore();
  const ref = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || !ref.current) return;
    ref.current.scrollLeft = ref.current.scrollWidth;
  }, [state.events, paused]);

  return (
    <div
      ref={ref}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="flex h-10 items-center gap-4 overflow-x-auto border-t border-line bg-[#100e0c] px-3 font-mono text-[12px] text-muted"
    >
      {state.events.slice(0, 40).map((e) => (
        <Link
          key={e.id}
          href={`/audit?subject=${encodeURIComponent(e.subjectId ?? "")}`}
          className="shrink-0 hover:text-fg"
        >
          <span className="text-amber/80">{tickerTime(e.at)}</span>{" "}
          <span className="text-fg/70">{e.actor}</span> {e.type}
          {e.subjectId ? ` ${String(e.subjectId).slice(0, 8)}` : ""}
        </Link>
      ))}
    </div>
  );
}
