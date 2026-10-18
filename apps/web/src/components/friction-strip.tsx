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

  const stats = [
    { n: f.messagesHandled, label: f.messagesHandled === 1 ? "message" : "messages" },
    { n: f.ordersCreated, label: f.ordersCreated === 1 ? "order" : "orders" },
    { n: f.reordersDrafted, label: f.reordersDrafted === 1 ? "reorder" : "reorders" },
    { n: f.guardCatches, label: f.guardCatches === 1 ? "guard catch" : "guard catches" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1 border-t border-line px-4 py-2 text-[13px] text-muted">
      <span className="badge-lime mr-2">Friction saved</span>
      {stats.map((s, i) => (
        <span key={s.label} className="inline-flex items-baseline gap-1.5 px-2">
          {i > 0 && <span className="mr-2 h-3 w-px self-center bg-line-strong" aria-hidden />}
          <CountUp value={s.n} className="text-[16px] font-semibold text-fg" />
          {s.label}
        </span>
      ))}
      <span className="ml-auto inline-flex items-baseline gap-1.5 rounded-full bg-basil/10 px-3 py-0.5 text-basil">
        ≈
        <CountUp value={f.ownerMinutesSaved} className="text-[16px] font-semibold" />
        owner minutes saved
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="self-center text-basil/70 hover:text-basil" aria-label="Minutes saved assumptions">
              <Info className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-[12px]">
            Assumes ≈{m.reply} min per reply, ≈{m.order} min per order, ≈{m.counteroffer} min per counteroffer, ≈
            {m.reorder} min per reorder, ≈{m.guardCatch} min per Guard catch, from the shop&apos;s profile.
          </TooltipContent>
        </Tooltip>
      </span>
    </div>
  );
}
