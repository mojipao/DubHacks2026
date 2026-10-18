"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/data/store";
import { BUSINESS } from "@/lib/business";
import { addDaysKey, localDateKey, money, personLabel } from "@/lib/format";
import { usePay } from "@/lib/use-pay";
import { cn } from "@/lib/utils";


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

  const satLabel = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).format(
    new Date(`${keys.saturday}T12:00:00Z`),
  );
  const tabs: [string, string][] = [
    ["today", "Today"],
    ["tomorrow", "Tomorrow"],
    ["saturday", satLabel],
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[20px] font-bold text-ink">Pickups</h2>
        <div role="tablist" aria-label="Day" className="flex gap-4">
          {tabs.map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={tab === v}
              onClick={() => setTab(v)}
              className={cn(
                "border-b-2 pb-1 text-[14px] font-semibold transition-colors duration-150",
                tab === v ? "border-brew text-ink" : "border-transparent text-muted hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {pickups.length === 0 ? (
        <p className="border-t border-line py-6 text-[15px] text-muted">No pickups this day.</p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {pickups.map((o) => {
            const time = new Intl.DateTimeFormat("en-US", {
              timeZone: BUSINESS.timezone,
              hour: "numeric",
              minute: "2-digit",
            }).format(new Date(o.pickupAt));
            const what = o.items.map((i) => `${i.qty} ${i.name.toLowerCase()}`).join(", ");
            const due = o.totalCents - o.discountCents;
            return (
              <li key={o.id} className="grid grid-cols-[4.75rem_1fr] gap-x-4 py-3.5">
                <span className="pt-0.5 text-[15px] font-bold text-ink tabular">{time}</span>
                <div className="min-w-0">
                  <div className="flex items-baseline text-[15px]">
                    <span className="min-w-0 truncate font-semibold text-ink">{personLabel(o.customerName)}</span>
                    <span className="leader" aria-hidden />
                    {o.status === "paid" ? (
                      <span className="shrink-0 font-semibold text-terrace tabular">Paid {money(due)}</span>
                    ) : (
                      <span className="shrink-0 text-qishr-ink tabular">{money(due)} due</span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-[14px] text-muted">
                      {what}
                      {o.hasShortfall && <span className="text-qamar"> · short on stock</span>}
                    </span>
                    {o.status === "awaiting_payment" && (
                      <button
                        type="button"
                        disabled={paying === o.id}
                        onClick={() => void pay(o.id, o.customerName?.split(" ")[0])}
                        title="Pays the order's Square sandbox link, like the customer tapping it"
                        className="shrink-0 text-[14px] font-semibold text-brew hover:underline disabled:opacity-50"
                      >
                        {paying === o.id ? "Paying…" : "Customer pays"}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
