"use client";

import type { TraceStep } from "@/lib/data/types";
import { cn } from "@/lib/utils";

const AGENT_DOT: Record<string, string> = {
  intake: "bg-sky",
  ops: "bg-amber",
  guard: "bg-tomato",
  winback: "bg-basil",
};

export function TraceTimeline({ steps }: { steps: TraceStep[] }) {
  if (steps.length === 0) {
    return (
      <p className="text-sm text-muted">
        No agent steps recorded for this trigger yet.
      </p>
    );
  }

  return (
    <ol className="relative space-y-0 border-l border-line pl-4">
      {steps.map((step) => (
        <li key={step.id} className="relative pb-4 last:pb-0">
          <span
            className={cn(
              "absolute -left-[21px] top-1 size-2.5 rounded-full ring-4 ring-panel",
              AGENT_DOT[step.agent] ?? "bg-muted",
            )}
          />
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
              {step.agent} · {step.step}
            </span>
            <span className="font-mono text-[11px] text-muted">{step.ms}ms</span>
          </div>
          <p className="mt-0.5 text-[14px] leading-snug text-fg">{step.summary}</p>
          {step.reads.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {step.reads.map((r, i) => (
                <span
                  key={`${r.table}-${r.id}-${i}`}
                  className="rounded bg-bg px-1.5 py-0.5 font-mono text-[10px] text-muted"
                >
                  {r.table}/{r.id.slice(0, 8)}
                </span>
              ))}
            </div>
          )}
          {step.flags.length > 0 && (
            <p className="mt-1 text-[12px] text-tomato">
              {step.flags.join(" · ")}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
