"use client";

import type { UiProposal } from "@/lib/data/types";
import { cn } from "@/lib/utils";

export function DoneStrip({
  tickets,
  onOpen,
  agentSent,
}: {
  tickets: UiProposal[];
  onOpen: (id: string) => void;
  /** Tickets the agent sent on its own (answers, no orders); marked so the owner can tell. */
  agentSent?: Set<string>;
}) {
  if (tickets.length === 0) return null;

  return (
    <div className="mt-5 flex items-center gap-2 overflow-x-auto border-t border-line pt-3.5">
      <span className="eyebrow shrink-0">Done</span>
      {tickets.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onOpen(t.id)}
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors hover:brightness-125",
            t.status === "executed" &&
              "border-basil/40 bg-basil/10 text-basil",
            t.status === "rejected" &&
              "border-tomato/40 bg-tomato/10 text-tomato",
            t.status !== "executed" &&
              t.status !== "rejected" &&
              "border-line text-muted",
          )}
        >
          {t.status === "executed" ? "✓" : "×"}{" "}
          {t.customerName ?? t.title.slice(0, 18)}
          {agentSent?.has(t.id) && <span className="ml-1 text-amber">· agent</span>}
        </button>
      ))}
    </div>
  );
}
