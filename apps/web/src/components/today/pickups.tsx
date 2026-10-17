"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStore } from "@/lib/data/store";
import { BUSINESS } from "@/lib/business";
import { cn } from "@/lib/utils";

function localDateKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function addLocalDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return localDateKey(d.toISOString());
}

function nextWeekday(from: Date, weekday: number): string {
  const d = new Date(from);
  const delta = (weekday + 7 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + delta);
  return localDateKey(d.toISOString());
}

export function PickupsBoard() {
  const { state } = useStore();
  const [tab, setTab] = useState("today");

  const keys = useMemo(() => {
    const now = new Date(state.now);
    return {
      today: localDateKey(state.now),
      tomorrow: addLocalDays(now, 1),
      saturday: nextWeekday(now, 6),
    };
  }, [state.now]);

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
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-mono text-[12px] tracking-[0.16em] text-muted uppercase">
          Pickups
        </h3>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-3 h-8 bg-bg">
          <TabsTrigger value="today" className="text-[12px]">
            Today
          </TabsTrigger>
          <TabsTrigger value="tomorrow" className="text-[12px]">
            Tomorrow
          </TabsTrigger>
          <TabsTrigger value="saturday" className="text-[12px]">
            Saturday
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <ul className="space-y-2">
        {pickups.length === 0 && (
          <li className="text-[13px] text-muted">No pickups this day.</li>
        )}
        {pickups.map((o) => {
          const time = new Intl.DateTimeFormat("en-US", {
            timeZone: BUSINESS.timezone,
            hour: "numeric",
            minute: "2-digit",
          }).format(new Date(o.pickupAt));
          const qty = o.items.reduce((n, i) => n + i.qty, 0);
          return (
            <li
              key={o.id}
              className="flex items-center justify-between gap-2 rounded-md border border-line bg-bg/50 px-2.5 py-2"
            >
              <div className="min-w-0">
                <div className="truncate text-[13px] text-fg">
                  <span className="font-mono text-muted">{time}</span>{" "}
                  {o.customerName ?? "Guest"} ×{qty}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {o.hasShortfall && (
                  <AlertTriangle className="size-3.5 text-tomato" />
                )}
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                    o.status === "paid"
                      ? "bg-basil/20 text-basil"
                      : "bg-amber/20 text-amber",
                  )}
                >
                  {o.status === "paid" ? "paid" : "awaiting"}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
