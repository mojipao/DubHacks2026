"use client";

import { cn } from "@/lib/utils";

export type View = "orders" | "today" | "people" | "ask";

export const VIEWS: { id: View; label: string; key: string; hint: string }[] = [
  { id: "orders", label: "Orders", key: "1", hint: "Replies and restocks waiting for you" },
  { id: "today", label: "Today", key: "2", hint: "Pickups, money, and anything running low" },
  { id: "people", label: "People", key: "3", hint: "Everyone who has texted or called, and their messages" },
  { id: "ask", label: "Ask", key: "4", hint: "Ask the agent about stock, text customers, or place a call" },
];

/** Plain text tabs on the brown band; the waiting count is the only colour. */
export function ViewTabs({
  view,
  onChange,
  waiting,
}: {
  view: View;
  onChange: (view: View) => void;
  /** Orders waiting on the owner. */
  waiting: number;
}) {
  return (
    <nav role="tablist" aria-label="Views" className="flex h-full items-stretch gap-0.5 sm:gap-1">
      {VIEWS.map((v) => {
        const active = v.id === view;
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
              "relative flex items-center gap-1.5 px-1.5 text-[14px] font-semibold transition-colors duration-150 sm:gap-2 sm:px-4 sm:text-[15px]",
              active ? "text-shell-fg" : "text-shell-fg/60 hover:text-shell-fg",
            )}
          >
            {v.label}
            {v.id === "orders" && waiting > 0 && (
              <span className="min-w-5 rounded-full bg-qishr px-1.5 text-center text-[12px] leading-5 font-bold text-shell tabular sm:min-w-6 sm:text-[13px] sm:leading-6">
                {waiting}
              </span>
            )}
            {/* The current tab sits on a gold sill, like a lit doorway on the band. */}
            <span
              aria-hidden
              className={cn(
                "absolute inset-x-3 bottom-0 h-[3px] rounded-t-full bg-qishr transition-opacity duration-150",
                active ? "opacity-100" : "opacity-0",
              )}
            />
          </button>
        );
      })}
    </nav>
  );
}
