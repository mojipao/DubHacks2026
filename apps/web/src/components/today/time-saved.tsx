"use client";

import { Info } from "lucide-react";
import { CountUp } from "@/components/count-up";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BUSINESS } from "@/lib/business";
import { useStore } from "@/lib/data/store";

/** The friction-saved tally: one big number, four small ones. */
export function TimeSaved() {
  const { state } = useStore();
  const f = state.friction;
  const m = BUSINESS.minutesSaved;
  const small = [
    { n: f.messagesHandled, label: "replies sent" },
    { n: f.ordersCreated, label: "orders" },
    { n: f.reordersDrafted, label: "restocks" },
    { n: f.guardCatches, label: "Guard catches" },
  ];
  return (
    <section className="border-t border-line/40 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="heading text-[15px] text-muted">Time saved</h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="text-muted hover:text-fg" aria-label="How this is estimated">
              <Info className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-[12px]">
            About {m.reply} min per reply, {m.order} per order, {m.counteroffer} per counteroffer, {m.reorder} per
            restock, {m.guardCatch} per Guard catch.
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <CountUp value={f.ownerMinutesSaved} className="heading text-[52px] text-crema" />
        <span className="text-[15px] text-muted">minutes of owner time</span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {small.map((s) => (
          <div key={s.label}>
            <dt className="sr-only">{s.label}</dt>
            <dd className="text-[22px] font-bold text-fg tabular-nums">
              <CountUp value={s.n} />
            </dd>
            <div className="text-[12px] text-muted">{s.label}</div>
          </div>
        ))}
      </dl>
    </section>
  );
}
