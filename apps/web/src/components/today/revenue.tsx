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
    <div className="mt-5 rounded-md border border-line bg-bg/50 px-3 py-2">
      <div className="font-mono text-[11px] tracking-[0.16em] text-muted uppercase">Paid today</div>
      <div className="text-[22px] font-semibold text-fg tabular-nums">{money(paidCents)}</div>
      <div className="text-[13px] text-muted">
        {agentOrders} order{agentOrders === 1 ? "" : "s"} created by agents today
      </div>
    </div>
  );
}
