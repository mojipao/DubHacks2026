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
    <div className="overflow-hidden rounded-[28px] bg-ink px-6 py-5 text-white">
      <div className="badge-lime">Paid today</div>
      <div className="mt-1 font-medium tracking-[-0.03em] text-[44px] leading-none text-white tabular-nums mt-3">{money(paidCents)}</div>
      <div className="mt-2 text-[13px] text-white/60">
        {agentOrders} order{agentOrders === 1 ? "" : "s"} created by agents today
      </div>
    </div>
  );
}
