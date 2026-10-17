"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/data/store";
import { tickerTime } from "@/lib/format";

function actorTone(actor: string) {
  if (actor === "owner") return "text-basil";
  if (actor === "customer") return "text-sky";
  if (actor === "agent:guard") return "text-tomato";
  if (actor.startsWith("agent:")) return "text-amber";
  return "text-fg/55";
}

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
      className="surface flex h-10 shrink-0 items-center gap-5 overflow-x-auto rounded-xl px-4 font-mono text-[12px] text-muted [mask-image:linear-gradient(90deg,transparent,black_4%,black_96%,transparent)] [scrollbar-width:none]"
    >
      {/* Events arrive newest first; the ticker reads left to right, so the newest sits at the right edge. */}
      {state.events.slice(0, 40).reverse().map((e) => (
        <Link
          key={e.id}
          href={`/audit?subject=${encodeURIComponent(e.subjectId ?? "")}`}
          className="shrink-0 hover:text-fg"
        >
          <span className="text-muted/70">{tickerTime(e.at)}</span>{" "}
          <span className={actorTone(e.actor)}>{e.actor}</span> <span className="text-fg/75">{e.type}</span>
          {e.subjectId ? ` ${String(e.subjectId).slice(0, 8)}` : ""}
        </Link>
      ))}
    </div>
  );
}
