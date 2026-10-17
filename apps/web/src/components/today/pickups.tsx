"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStore } from "@/lib/data/store";
import { BUSINESS } from "@/lib/business";
import { addDaysKey, localDateKey } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function PickupsBoard() {
  const { state, markPaid } = useStore();
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
              className="group flex items-center justify-between gap-2 rounded-md border border-line bg-bg/50 px-2.5 py-2"
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
                {o.status === "awaiting_payment" && (
                  <button
                    type="button"
                    title="Demo fallback when the Square webhook can't reach this laptop"
                    onClick={() =>
                      void markPaid(o.id)
                        .then(() => toast.success("Marked paid"))
                        .catch((e: Error) => toast.error(e.message))
                    }
                    className="rounded px-1.5 py-0.5 text-[10px] text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-fg focus-visible:opacity-100"
                  >
                    mark paid
                  </button>
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
