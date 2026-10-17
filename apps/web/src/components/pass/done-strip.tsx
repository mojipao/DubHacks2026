"use client";

import type { UiProposal } from "@/lib/data/types";
import { cn } from "@/lib/utils";

export function DoneStrip({
  tickets,
  onOpen,
}: {
  tickets: UiProposal[];
  onOpen: (id: string) => void;
}) {
  if (tickets.length === 0) return null;

  return (
    <div className="mt-3 flex items-center gap-2 overflow-x-auto border-t border-line/80 pt-3">
      <span className="shrink-0 font-mono text-[11px] tracking-[0.16em] text-muted uppercase">
        Done ▸
      </span>
      {tickets.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onOpen(t.id)}
          className={cn(
            "shrink-0 rounded-[4px] border px-2 py-1 font-mono text-[11px]",
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
        </button>
      ))}
    </div>
  );
}
