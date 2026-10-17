"use client";

import { motion, useReducedMotion } from "motion/react";
import type { TraceStep } from "@/lib/data/types";
import { flagMeta } from "@/lib/flags";
import { cn } from "@/lib/utils";

export const AGENT_DOT: Record<string, string> = {
  intake: "bg-sky",
  ops: "bg-amber",
  guard: "bg-tomato",
  winback: "bg-basil",
};

const AGENT_TEXT: Record<string, string> = {
  intake: "text-sky",
  ops: "text-amber",
  guard: "text-tomato",
  winback: "text-basil",
};

/** "orders ×14" instead of fourteen chips. */
function groupReads(reads: TraceStep["reads"]) {
  const counts = new Map<string, number>();
  for (const r of reads) counts.set(r.table, (counts.get(r.table) ?? 0) + 1);
  return [...counts.entries()];
}

export function TraceTimeline({ steps }: { steps: TraceStep[] }) {
  const reduce = useReducedMotion();
  if (steps.length === 0) {
    return (
      <p className="text-[13px] text-muted">
        No agent steps recorded for this ticket. Win-back drafts and older tickets may not carry a trace.
      </p>
    );
  }

  const totalMs = steps.reduce((n, s) => n + s.ms, 0);

  return (
    <div>
      <p className="mb-3 font-mono text-[12px] text-muted">
        {steps.length} steps · {totalMs >= 1000 ? `${(totalMs / 1000).toFixed(1)} s` : `${totalMs} ms`} of agent time
      </p>
      <ol className="relative ml-1 border-l border-line pl-5">
        {steps.map((step, i) => (
          <motion.li
            key={step.id}
            initial={reduce ? false : { opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: reduce ? 0 : i * 0.06 }}
            className="relative pb-4 last:pb-0"
          >
            <span
              className={cn(
                "absolute top-1 -left-[26px] size-2.5 rounded-full ring-4 ring-panel",
                AGENT_DOT[step.agent] ?? "bg-muted",
              )}
            />
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span
                className={cn(
                  "font-mono text-[11px] font-semibold tracking-wider uppercase",
                  AGENT_TEXT[step.agent] ?? "text-muted",
                )}
              >
                {step.agent}
              </span>
              <span className="font-mono text-[11px] tracking-wider text-muted uppercase">{step.step}</span>
              <span className="ml-auto font-mono text-[11px] text-muted tabular-nums">{step.ms} ms</span>
            </div>
            <p className="mt-0.5 text-[14px] leading-snug text-fg">{step.summary}</p>
            {(step.reads.length > 0 || step.flags.length > 0) && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {step.flags.map((f) => (
                  <span
                    key={f}
                    className="rounded bg-tomato/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-[#f08a68] uppercase"
                  >
                    {flagMeta(f).label}
                  </span>
                ))}
                {groupReads(step.reads).map(([table, n]) => (
                  <span
                    key={table}
                    className="rounded bg-bg px-1.5 py-0.5 font-mono text-[10px] text-muted"
                    title={step.reads
                      .filter((r) => r.table === table)
                      .map((r) => `${r.table}/${r.id}`)
                      .join("\n")}
                  >
                    {table}
                    {n > 1 ? ` ×${n}` : ""}
                  </span>
                ))}
              </div>
            )}
          </motion.li>
        ))}
      </ol>
    </div>
  );
}
