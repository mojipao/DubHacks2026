"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchContacts, fetchOps } from "@/lib/actions";
import { useStore } from "@/lib/data/store";
import type { OpsReport, UiContact } from "@/lib/data/types";
import { money } from "@/lib/format";
import { opsFromStore } from "@/lib/ops-from-store";
import { cn } from "@/lib/utils";

function shortDay(date: string): string {
  const [, , d] = date.split("-");
  return String(Number(d));
}

function BarRow({ label, value, max, note }: { label: string; value: number; max: number; note?: string }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <li className="py-2.5">
      <div className="flex items-baseline justify-between gap-3 text-[14px]">
        <span className="truncate font-semibold text-ink">{label}</span>
        <span className="shrink-0 tabular text-muted">{note ?? money(value)}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <div className="h-full rounded-full bg-[#9c8470] transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}

/** Leads, Square-paid sales, stock days-of-cover — the data layer behind the pass. */
export function OpsView() {
  const { state, listContacts } = useStore();
  const [report, setReport] = useState<OpsReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        if (state.connection === "mock") {
          const contacts = await listContacts();
          if (!cancelled) setReport(opsFromStore(state, contacts));
          return;
        }
        const [ops, wrapped] = await Promise.all([fetchOps<OpsReport>(), fetchContacts<UiContact>()]);
        if (cancelled) return;
        const contacts = wrapped.contacts;
        // Funnel from /contacts is the live lead list; keep ops sales/stock from the server.
        setReport({
          ...ops,
          funnel: contacts.reduce(
            (f, c) => {
              if (c.role === "owner") return f;
              if (c.stage === "paid") f.paid += 1;
              else if (c.stage === "ordered") f.ordered += 1;
              else if (c.stage === "regular") f.regular += 1;
              else if (c.stage === "lead") f.leads += 1;
              return f;
            },
            { leads: 0, ordered: 0, paid: 0, regular: 0 },
          ),
        });
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load house numbers");
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [state.connection, state.orders, state.ingredients, state.events, state.now, listContacts]);

  if (error && !report) {
    return (
      <div id="view-ops" role="tabpanel" className="min-h-0 flex-1 overflow-y-auto px-8 py-10 text-[16px] text-muted">
        {error}. Start the demo host, then come back.
      </div>
    );
  }
  if (!report) {
    return (
      <div id="view-ops" role="tabpanel" className="min-h-0 flex-1 overflow-y-auto px-8 py-10 text-[16px] text-muted">
        Reading paid orders and stock…
      </div>
    );
  }

  const { funnel, sales, stock, observability } = report;
  const dayMax = Math.max(1, ...sales.byDay.map((d) => d.onlineCents));
  const productMax = Math.max(1, ...sales.byProduct.map((p) => p.cents));
  const low = stock.filter((s) => s.daysOfCover !== null && s.daysOfCover <= 14);

  return (
    <div id="view-ops" role="tabpanel" className="min-h-0 min-w-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-8 pt-7 pb-14">
        <h1 className="heading text-[34px] text-ink">House</h1>
        <p className="mt-2 max-w-3xl text-[18px] leading-relaxed text-ink">
          Online sales after Square says paid. Stock burn from those orders plus history. Leads are anyone who texted and has not paid yet.
        </p>

        <section className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
          {(
            [
              ["Leads", funnel.leads, "Texted, no agent order"],
              ["Ordered", funnel.ordered, "Ticket in, not paid"],
              ["Paid", funnel.paid, "Square confirmed"],
              ["Regulars", funnel.regular, "History, not this loop"],
            ] as const
          ).map(([label, n, hint]) => (
            <div key={label} className="bg-paper px-5 py-4">
              <p className="text-[13px] font-semibold tracking-wide text-muted uppercase">{label}</p>
              <p className="heading mt-1 text-[32px] tabular text-ink">{n}</p>
              <p className="mt-1 text-[13px] text-muted">{hint}</p>
            </div>
          ))}
        </section>

        <div className="mt-12 grid gap-x-14 gap-y-12 lg:grid-cols-2">
          <section>
            <h2 className="mb-1 text-[20px] font-bold text-ink">Sales from texts</h2>
            <p className="mb-4 text-[14px] text-muted">
              <span className="font-bold tabular text-ink">{money(sales.onlinePaidCents)}</span> paid
              {sales.squarePaidOrders > 0 && (
                <>
                  {" "}
                  · {sales.squarePaidOrders} Square {sales.squarePaidOrders === 1 ? "settlement" : "settlements"}
                </>
              )}
              {sales.awaitingCents > 0 && (
                <>
                  {" "}
                  · {money(sales.awaitingCents)} waiting on a link
                </>
              )}
              {sales.historyPaidCents > 0 && (
                <>
                  {" "}
                  · {money(sales.historyPaidCents)} seeded history
                </>
              )}
            </p>
            <div className="flex h-28 items-end gap-1 border-b border-line pb-0">
              {sales.byDay.map((d) => {
                const h = Math.round((d.onlineCents / dayMax) * 100);
                return (
                  <div key={d.date} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                    <div
                      className={cn("w-full rounded-t-sm", d.onlineCents > 0 ? "bg-[#9c8470]" : "bg-surface-2")}
                      style={{ height: `${Math.max(d.onlineCents > 0 ? 6 : 2, h)}%` }}
                      title={`${d.date}: ${money(d.onlineCents)} · ${d.onlineOrders} paid`}
                    />
                    <span className="text-[10px] tabular text-muted">{shortDay(d.date)}</span>
                  </div>
                );
              })}
            </div>
            <ul className="mt-6 divide-y divide-line border-t border-line">
              {sales.byProduct.length === 0 ? (
                <li className="py-4 text-[15px] text-muted">No Square-paid text orders yet. Approve one, then pay the link.</li>
              ) : (
                sales.byProduct.map((p) => (
                  <BarRow
                    key={p.productId}
                    label={`${p.name} · ${p.units}`}
                    value={p.cents}
                    max={productMax}
                    note={`${p.units} · ${money(p.cents)}`}
                  />
                ))
              )}
            </ul>
          </section>

          <section>
            <h2 className="mb-1 text-[20px] font-bold text-ink">Stock to replenish</h2>
            <p className="mb-4 text-[14px] text-muted">Average use over 28 days of paid orders. Restock-by is when on-hand hits the reorder point.</p>
            <ul className="divide-y divide-line border-t border-line">
              {(low.length > 0 ? low : stock.slice(0, 8)).map((s) => (
                <li key={s.ingredientId} className="flex items-baseline justify-between gap-3 py-3 text-[15px]">
                  <span className={cn("font-semibold", s.daysOfCover !== null && s.daysOfCover <= 7 ? "text-qamar" : "text-ink")}>
                    {s.name}
                  </span>
                  <span className="shrink-0 text-[14px] tabular text-muted">
                    {s.avgPerDay > 0 ? `${s.avgPerDay} ${s.unit}/day` : "no burn"}
                    {s.daysOfCover !== null && ` · ${s.daysOfCover}d cover`}
                    {s.restockBy && ` · by ${s.restockBy.slice(5)}`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="mt-12">
          <h2 className="mb-3 text-[20px] font-bold text-ink">Line</h2>
          <dl className="grid grid-cols-2 gap-x-10 gap-y-3 border-t border-line pt-4 text-[15px] sm:grid-cols-3">
            <div>
              <dt className="text-muted">Photon</dt>
              <dd className="font-semibold text-ink">
                {observability.photonConnected ? "connected" : observability.photonMode === "off" ? "off this machine" : "not connected"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Square</dt>
              <dd className="font-semibold text-ink">{observability.square ? "sandbox" : "simulated"}</dd>
            </div>
            <div>
              <dt className="text-muted">Autonomy</dt>
              <dd className="font-semibold text-ink">{observability.autonomy}</dd>
            </div>
            <div>
              <dt className="text-muted">Waiting tickets</dt>
              <dd className="font-semibold tabular text-ink">{observability.pendingTickets}</dd>
            </div>
            <div>
              <dt className="text-muted">Agent steps</dt>
              <dd className="font-semibold tabular text-ink">{observability.agentSteps}</dd>
            </div>
            <div>
              <dt className="text-muted">Trust log</dt>
              <dd>
                <Link href="/audit" className="font-semibold text-brew hover:underline">
                  Open /audit
                </Link>
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
