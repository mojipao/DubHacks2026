"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/data/store";
import { BUSINESS } from "@/lib/business";
import { money } from "@/lib/format";

function localDateKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function TodayRevenue() {
  const { state } = useStore();
  const today = localDateKey(state.now);

  const { paidCents, agentOrders } = useMemo(() => {
    let paidCents = 0;
    let agentOrders = 0;
    for (const o of state.orders) {
      if (o.source === "agent") {
        const createdDay = localDateKey(o.pickupAt);
        if (createdDay === today || o.status === "paid" || o.status === "awaiting_payment") {
          // count agent-origin orders visible today board loosely
        }
        agentOrders += 1;
      }
      if (o.status === "paid") {
        paidCents += o.totalCents - o.discountCents;
      }
    }
    return { paidCents, agentOrders };
  }, [state.orders, today]);

  return (
    <div className="mt-5 rounded-md border border-line bg-bg/50 px-3 py-2">
      <div className="font-mono text-[11px] tracking-[0.16em] text-muted uppercase">
        Paid today
      </div>
      <div className="text-[22px] font-semibold text-fg">{money(paidCents)}</div>
      <div className="text-[12px] text-muted">
        {agentOrders} order{agentOrders === 1 ? "" : "s"} created by agents
      </div>
    </div>
  );
}
