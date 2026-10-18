"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStore } from "@/lib/data/store";
import { BUSINESS } from "@/lib/business";
import { addDaysKey, localDateKey, money } from "@/lib/format";
import { usePay } from "@/lib/use-pay";


export function PickupsBoard() {
  const { state } = useStore();
  const { pay, paying } = usePay();
  const [tab, setTab] = useState("today");

  const todayKey = localDateKey(state.now);
  const keys = useMemo(() => {
    const weekday = new Date(`${todayKey}T12:00:00Z`).getUTCDay();
    return {
      today: todayKey,
      tomorrow: addDaysKey(todayKey, 1),
      // Next Saturday; on a Saturday that's a week out, since "Today" already covers it.
      saturday: addDaysKey(todayKey, (6 + 7 - weekday) % 7 || 7),
    };
  }, [todayKey]);

  const selectedKey =
    tab === "tomorrow"
      ? keys.tomorrow
      : tab === "saturday"
        ? keys.saturday
        : keys.today;

  const pickups = state.orders
    .filter((o) => localDateKey(o.pickupAt) === selectedKey)
    .filter((o) => o.status === "awaiting_payment" || o.status === "paid")
    .sort((a, b) => Date.parse(a.pickupAt) - Date.parse(b.pickupAt));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="heading text-[22px] text-fg">Pickups</h2>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-9 rounded-full border border-line bg-bg/60 p-1">
            {[
              ["today", "Today"],
              ["tomorrow", "Tomorrow"],
              ["saturday", "Saturday"],
            ].map(([v, label]) => (
              <TabsTrigger
                key={v}
                value={v}
                className="rounded-full px-3 text-[12px] font-semibold text-muted data-[state=active]:bg-ticket data-[state=active]:text-ink"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <ul className="space-y-2">
        {pickups.length === 0 && <li className="py-6 text-center text-[14px] text-muted">No pickups this day.</li>}
        {pickups.map((o) => {
          const time = new Intl.DateTimeFormat("en-US", {
            timeZone: BUSINESS.timezone,
            hour: "numeric",
            minute: "2-digit",
          }).format(new Date(o.pickupAt));
          const what = o.items.map((i) => `${i.qty} ${i.name.toLowerCase()}`).join(", ");
          const due = o.totalCents - o.discountCents;
          return (
            <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[16px] bg-bg/50 px-4 py-3">
              <span className="w-16 shrink-0 text-[15px] font-bold text-fg tabular-nums">{time}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-fg">{o.customerName ?? "Guest"}</span>
                <span className="block truncate text-[13px] text-muted">{what}</span>
              </span>
              {o.hasShortfall && <AlertTriangle className="size-4 text-tomato" aria-label="Short on stock" />}
              {o.status === "paid" ? (
                <span className="rounded-full bg-basil/15 px-3 py-1 text-[12px] font-bold tracking-wide text-basil uppercase">
                  Paid {money(due)}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span className="text-[13px] text-amber">{money(due)} due</span>
                  <button
                    type="button"
                    disabled={paying === o.id}
                    onClick={() => void pay(o.id, o.customerName?.split(" ")[0])}
                    title="Pays the order's Square sandbox link, like the customer tapping it"
                    className="rounded-full bg-cherry px-3.5 py-1.5 text-[12px] font-bold tracking-wide text-white uppercase transition-opacity hover:bg-cherry/90 disabled:opacity-50"
                  >
                    {paying === o.id ? "Paying…" : "Customer pays"}
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
