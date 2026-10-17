"use client";

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CountUp } from "@/components/count-up";
import { BUSINESS } from "@/lib/business";
import { useStore } from "@/lib/data/store";

export function FrictionStrip() {
  const { state } = useStore();
  const f = state.friction;
  const m = BUSINESS.minutesSaved;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-bg/70 px-4 py-2 text-[13px] text-muted">
      <span className="font-mono text-[11px] tracking-[0.18em] text-amber uppercase">
        Friction saved
      </span>
      <span>
        <CountUp value={f.messagesHandled} className="font-mono text-[15px] font-semibold text-fg" />{" "}
        messages
      </span>
      <span>
        <CountUp value={f.ordersCreated} className="font-mono text-[15px] font-semibold text-fg" />{" "}
        orders
      </span>
      <span>
        <CountUp value={f.reordersDrafted} className="font-mono text-[15px] font-semibold text-fg" />{" "}
        reorder{f.reordersDrafted === 1 ? "" : "s"}
      </span>
      <span>
        <CountUp value={f.guardCatches} className="font-mono text-[15px] font-semibold text-fg" />{" "}
        guard catch{f.guardCatches === 1 ? "" : "es"}
      </span>
      <span className="inline-flex items-center gap-1">
        ≈
        <CountUp value={f.ownerMinutesSaved} className="font-mono text-[15px] font-semibold text-fg" />{" "}
        owner min
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-muted hover:text-fg"
              aria-label="Minutes saved assumptions"
            >
              <Info className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-[12px]">
            Assumes ≈{m.reply} min per reply, ≈{m.order} min per order, ≈
            {m.counteroffer} min per counteroffer, ≈{m.reorder} min per reorder, ≈
            {m.guardCatch} min per Guard catch — from BusinessProfile.minutesSaved.
          </TooltipContent>
        </Tooltip>
      </span>
    </div>
  );
}
