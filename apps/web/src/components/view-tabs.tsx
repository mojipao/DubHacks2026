"use client";

import { motion, useReducedMotion } from "motion/react";
import { CalendarClock, MessagesSquare, ReceiptText } from "lucide-react";
import { cn } from "@/lib/utils";

export type View = "pass" | "conversations" | "today";

export const VIEWS: { id: View; label: string; key: string; icon: typeof ReceiptText }[] = [
  { id: "pass", label: "The pass", key: "1", icon: ReceiptText },
  { id: "conversations", label: "Conversations", key: "2", icon: MessagesSquare },
  { id: "today", label: "Today", key: "3", icon: CalendarClock },
];

/** Top-level switch between the pass, conversations, and the day's pickups and stock. */
export function ViewTabs({
  view,
  onChange,
  counts,
}: {
  view: View;
  onChange: (view: View) => void;
  /** Badge per tab; `alert` tints it saffron (something needs the owner). */
  counts: Record<View, { n: number; alert?: boolean }>;
}) {
  const reduce = useReducedMotion();
  return (
    <nav role="tablist" aria-label="Control room views" className="flex items-center gap-1 px-3 pb-2.5">
      {VIEWS.map((v) => {
        const active = v.id === view;
        const c = counts[v.id];
        return (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`view-${v.id}`}
            onClick={() => onChange(v.id)}
            title={`${v.label} (${v.key})`}
            className={cn(
              "relative flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
              active ? "text-ink" : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            {active && (
              <motion.span
                layoutId="view-tab-pill"
                className="absolute inset-0 rounded-full bg-ticket"
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <v.icon className="relative size-4" />
            <span className="relative">{v.label}</span>
            {c.n > 0 && (
              <span
                className={cn(
                  "relative min-w-5 rounded-full px-1.5 text-center font-mono text-[11px] leading-5 tabular-nums",
                  c.alert ? "bg-amber text-ink" : active ? "bg-ink/10 text-ink" : "bg-surface-2 text-fg/80",
                )}
              >
                {c.n}
              </span>
            )}
          </button>
        );
      })}
      <span className="ml-auto hidden font-mono text-[11px] text-muted lg:inline">
        <kbd className="rounded border border-line-strong bg-surface-2 px-1 text-fg/80">1</kbd>
        <kbd className="ml-0.5 rounded border border-line-strong bg-surface-2 px-1 text-fg/80">2</kbd>
        <kbd className="ml-0.5 rounded border border-line-strong bg-surface-2 px-1 text-fg/80">3</kbd> switch views
      </span>
    </nav>
  );
}
