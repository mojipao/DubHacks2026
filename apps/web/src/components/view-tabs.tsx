"use client";

import { motion, useReducedMotion } from "motion/react";
import { CalendarClock, ClipboardCheck, MessagesSquare, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type View = "pass" | "conversations" | "customers" | "today";

export const VIEWS: { id: View; label: string; key: string; icon: typeof ClipboardCheck; hint: string }[] = [
  { id: "pass", label: "Pass", key: "1", icon: ClipboardCheck, hint: "Replies and restocks waiting for you" },
  { id: "conversations", label: "Messages", key: "2", icon: MessagesSquare, hint: "Every text thread" },
  { id: "customers", label: "Leads", key: "3", icon: Users, hint: "Everyone who has texted, and whether they ordered" },
  { id: "today", label: "Today", key: "4", icon: CalendarClock, hint: "Pickups, money, stock, time saved" },
];

/** The four views. A cherry badge means something is waiting on the owner. */
export function ViewTabs({
  view,
  onChange,
  counts,
}: {
  view: View;
  onChange: (view: View) => void;
  counts: Record<View, { n: number; alert?: boolean }>;
}) {
  const reduce = useReducedMotion();
  return (
    <nav role="tablist" aria-label="Views" className="flex items-center gap-1 overflow-x-auto">
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
            title={`${v.hint} (${v.key})`}
            className={cn(
              "relative flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-[15px] font-semibold tracking-wide uppercase transition-colors",
              active ? "text-ink" : "text-muted hover:text-fg",
            )}
          >
            {active && (
              <motion.span
                layoutId="view-tab-pill"
                className="absolute inset-0 rounded-full bg-ticket"
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <v.icon className="relative size-[18px]" />
            <span className="relative">{v.label}</span>
            {c.n > 0 && (
              <span
                className={cn(
                  "relative min-w-5 rounded-full px-1.5 text-center text-[13px] leading-5 font-bold tabular-nums",
                  c.alert ? "bg-cherry text-white" : active ? "bg-ink/10 text-ink" : "bg-surface-2 text-fg",
                )}
              >
                {c.n}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
