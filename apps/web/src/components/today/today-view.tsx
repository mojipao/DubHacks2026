"use client";

import { Info } from "lucide-react";
import { Activity } from "@/components/today/activity";
import { PickupsBoard } from "@/components/today/pickups";
import { StockBars } from "@/components/today/stock-bars";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BUSINESS } from "@/lib/business";
import { useStore } from "@/lib/data/store";
import { localDateKey, money } from "@/lib/format";

/** The day in one sentence, then the board, then only the stock that needs you. */
export function TodayView() {
  const { state } = useStore();
  const today = localDateKey(state.now);
  const paid = state.orders
    .filter((o) => o.paidAt && localDateKey(o.paidAt) === today)
    .reduce((n, o) => n + o.totalCents - o.discountCents, 0);
  const agentOrders = state.orders.filter((o) => o.source === "agent" && localDateKey(o.createdAt) === today).length;
  const f = state.friction;
  const m = BUSINESS.minutesSaved;
  const dayLabel = new Intl.DateTimeFormat("en-US", { timeZone: BUSINESS.timezone, weekday: "long", month: "long", day: "numeric" }).format(
    new Date(state.now),
  );

  return (
    <div id="view-today" role="tabpanel" className="min-h-0 min-w-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-8 pt-7 pb-12">
        <h1 className="heading text-[34px] text-ink">{dayLabel}</h1>
        <p className="mt-2 max-w-3xl text-[19px] leading-relaxed text-ink">
          <span className="font-bold tabular">{money(paid)}</span> paid so far
          <span className="text-muted"> · </span>
          <span className="font-bold tabular">{agentOrders}</span> {agentOrders === 1 ? "order" : "orders"} taken by text
          <span className="text-muted"> · </span>
          about <span className="font-bold tabular">{f.ownerMinutesSaved}</span> minutes of your time saved
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" aria-label="How minutes saved are estimated" className="ml-1.5 inline-flex align-middle text-muted hover:text-ink">
                <Info className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-[13px]">
              An estimate: about {m.reply} min per reply, {m.order} per order, {m.counteroffer} per counteroffer, {m.reorder} per restock, and {m.guardCatch}{" "}
              per Guard catch. So far: {f.messagesHandled} replies, {f.ordersCreated} orders, {f.reordersDrafted} restocks, {f.guardCatches} Guard catches.
            </TooltipContent>
          </Tooltip>
        </p>

        {/* Phones read Pickups, Stock, then history; wide screens keep Stock beside both and pinned while the log scrolls. */}
        <div className="mt-10 grid gap-x-14 gap-y-12 lg:grid-cols-[1.2fr_1fr]">
          <PickupsBoard />
          <div className="lg:sticky lg:top-0 lg:row-span-2 lg:self-start">
            <StockBars />
          </div>
          <div className="lg:col-start-1">
            <Activity />
          </div>
        </div>
      </div>
    </div>
  );
}
