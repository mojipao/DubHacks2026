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
    <div className="surface overflow-hidden rounded-xl bg-gradient-to-br from-basil/10 via-surface to-surface px-5 py-4">
      <div className="eyebrow">Paid today</div>
      <div className="mt-1 font-serif text-[34px] leading-none text-fg tabular-nums">{money(paidCents)}</div>
      <div className="mt-1.5 text-[13px] text-muted">
        {agentOrders} order{agentOrders === 1 ? "" : "s"} created by agents today
      </div>
    </div>
  );
}
