"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, MessageSquare } from "lucide-react";
import { useStore } from "@/lib/data/store";
import type { ContactStage, UiContact } from "@/lib/data/types";
import { money, shortRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STAGES: { id: Exclude<ContactStage, "owner">; label: string; hint: string; tone: string }[] = [
  { id: "lead", label: "New", hint: "Texted, no order yet", tone: "bg-sky/15 text-sky" },
  { id: "ordered", label: "Ordered", hint: "Order drafted or waiting for payment", tone: "bg-amber/15 text-amber" },
  { id: "paid", label: "Paid", hint: "Paid through the agents", tone: "bg-basil/15 text-basil" },
  { id: "regular", label: "Regular", hint: "Long order history", tone: "bg-crema/20 text-crema" },
];

/** Everyone who has texted the shop, where they are in the funnel, and what they've spent (lane 2's GET /contacts). */
export function LeadsView({ onOpenConversation }: { onOpenConversation: (conversationId: string) => void }) {
  const { state, mode, listContacts } = useStore();
  const [contacts, setContacts] = useState<UiContact[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<ContactStage | "all">("all");

  // Refresh whenever a text, order, or ticket lands; the realtime store already tells us.
  const signal = `${state.messages.length}:${state.orders.map((o) => o.status).join("")}:${state.proposals.length}`;
  useEffect(() => {
    let live = true;
    listContacts()
      .then((rows) => {
        if (!live) return;
        setContacts(rows.filter((r) => r.role !== "owner"));
        setError(null);
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [listContacts, signal]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of contacts ?? []) c[r.stage] = (c[r.stage] ?? 0) + 1;
    return c;
  }, [contacts]);

  const rows = (contacts ?? []).filter((r) => stage === "all" || r.stage === stage);

  const exportCsv = () => {
    if (mode === "live") {
      window.location.href = "/api/contacts?format=csv";
      return;
    }
    // Mock mode has no server, so build the same columns in the browser.
    const cols = ["name", "handle", "stage", "platform", "lastMessageAt", "inbound", "outbound", "paidCents", "awaitingCents"];
    const cell = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
    const csv = [
      cols.join(","),
      ...(contacts ?? []).map((r) =>
        [r.name, r.handleMasked, r.stage, r.platform, r.lastMessageAt, r.messages.inbound, r.messages.outbound, r.orders.paidCents, r.orders.awaitingCents]
          .map(cell)
          .join(","),
      ),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Leads exported");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h1 className="heading text-[30px] text-fg">Customers</h1>
          <p className="mt-1 text-[14px] text-muted">Everyone who has texted the shop. Nobody gets lost.</p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-[13px] font-semibold tracking-wide text-fg uppercase hover:bg-surface-2"
        >
          <Download className="size-4" />
          Export CSV
        </button>
      </div>

      {/* The funnel, doubling as the filter. */}
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4" role="group" aria-label="Filter by stage">
        {STAGES.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={stage === s.id}
            onClick={() => setStage(stage === s.id ? "all" : s.id)}
            className={cn(
              "surface rounded-[18px] px-5 py-4 text-left transition-colors hover:border-line-strong",
              stage === s.id && "border-crema bg-surface-2",
            )}
          >
            <div className="text-[34px] leading-none font-extrabold text-fg tabular-nums">{counts[s.id] ?? 0}</div>
            <div className="mt-2 flex items-center gap-2">
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase", s.tone)}>{s.label}</span>
              <span className="truncate text-[12px] text-muted">{s.hint}</span>
            </div>
          </button>
        ))}
      </div>

      <section className="min-h-0 flex-1 overflow-y-auto">
        {error ? (
          <p className="p-6 text-[14px] text-tomato">Couldn&apos;t load customers: {error}</p>
        ) : contacts === null ? (
          <p className="p-6 text-[14px] text-muted">Loading customers…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-[14px] text-muted">No one here yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r) => {
              const meta = STAGES.find((s) => s.id === r.stage);
              return (
                <li key={r.conversationId}>
                  <button
                    type="button"
                    onClick={() => onOpenConversation(r.conversationId)}
                    className="grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-6 py-4 text-left hover:bg-surface-2 md:grid-cols-[minmax(0,1.4fr)_120px_140px_minmax(0,1.6fr)_90px]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[16px] font-semibold text-fg">{r.name ?? r.handleMasked}</span>
                      <span className="block text-[12px] text-muted">
                        {r.name ? r.handleMasked : "No name yet"} · {r.platform === "imessage" ? "iMessage" : "simulated"}
                      </span>
                    </span>
                    <span className="justify-self-end md:justify-self-start">
                      {meta && (
                        <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase", meta.tone)}>
                          {meta.label}
                        </span>
                      )}
                    </span>
                    <span className="hidden text-[14px] md:block">
                      {r.orders.paidCents > 0 ? (
                        <span className="font-semibold text-basil">{money(r.orders.paidCents)} paid</span>
                      ) : r.orders.awaitingCents > 0 ? (
                        <span className="text-amber">{money(r.orders.awaitingCents)} due</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </span>
                    <span className="col-span-2 truncate text-[13px] text-muted md:col-span-1">
                      {r.lastMessage ? `${r.lastMessage.direction === "outbound" ? "You: " : ""}${r.lastMessage.body}` : ""}
                    </span>
                    <span className="hidden items-center justify-end gap-1.5 text-[12px] text-muted md:flex">
                      <MessageSquare className="size-3.5" />
                      {r.messages.inbound + r.messages.outbound} · {shortRelativeTime(r.lastMessageAt)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
