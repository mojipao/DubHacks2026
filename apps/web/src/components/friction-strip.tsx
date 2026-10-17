"use client";

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BUSINESS } from "@/lib/business";
import { useStore } from "@/lib/data/store";

export function FrictionStrip() {
  const { state } = useStore();
  const f = state.friction;
  const m = BUSINESS.minutesSaved;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-bg/70 px-4 py-2 text-[13px] text-muted">
      <span className="font-mono text-[11px] tracking-[0.18em] text-amber uppercase">
        Saved today
      </span>
      <span>
        <span className="font-mono text-[15px] font-semibold text-fg tabular-nums">
          {f.messagesHandled}
        </span>{" "}
        messages
      </span>
      <span>
        <span className="font-mono text-[15px] font-semibold text-fg tabular-nums">
          {f.ordersCreated}
        </span>{" "}
        orders
      </span>
      <span>
        <span className="font-mono text-[15px] font-semibold text-fg tabular-nums">
          {f.reordersDrafted}
        </span>{" "}
        reorder{f.reordersDrafted === 1 ? "" : "s"}
      </span>
      <span>
        <span className="font-mono text-[15px] font-semibold text-fg tabular-nums">
          {f.guardCatches}
        </span>{" "}
        guard catch{f.guardCatches === 1 ? "" : "es"}
      </span>
      <span className="inline-flex items-center gap-1">
        ≈
        <span className="font-mono text-[15px] font-semibold text-fg tabular-nums">
          {f.ownerMinutesSaved}
        </span>{" "}
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
