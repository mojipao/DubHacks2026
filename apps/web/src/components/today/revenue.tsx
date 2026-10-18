"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/data/store";
import { localDateKey, money } from "@/lib/format";

export function TodayRevenue() {
  const { state } = useStore();
  const today = localDateKey(state.now);

  const { paidCents, agentOrders } = useMemo(() => {
    let paidCents = 0;
    let agentOrders = 0;
    for (const o of state.orders) {
      if (o.paidAt && localDateKey(o.paidAt) === today) {
        paidCents += o.totalCents - o.discountCents;
      }
      if (o.source === "agent" && localDateKey(o.createdAt) === today) agentOrders += 1;
    }
    return { paidCents, agentOrders };
  }, [state.orders, today]);

  return (
    <div className="overflow-hidden border-t border-line pt-5 text-ink">
      <div className="heading text-[15px] text-ink/60">Paid today</div>
      <div className="mt-1 heading text-[52px] text-ink tabular-nums">{money(paidCents)}</div>
      <div className="mt-2 text-[14px] text-ink/60">
        {agentOrders} order{agentOrders === 1 ? "" : "s"} created by agents today
      </div>
    </div>
  );
}
