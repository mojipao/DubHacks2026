"use client";

import type { ReplyPayload, ReorderPayload } from "@boh/shared";
import { useMemo } from "react";
import { Shield, Smartphone } from "lucide-react";
import { openHolds } from "@/lib/data/derive";
import { useStore } from "@/lib/data/store";
import type { UiProposal } from "@/lib/data/types";
import { flagMeta, isGuardFlag } from "@/lib/flags";
import { maskHandle, money, shortRelativeTime } from "@/lib/format";
import { groupTotals, orderSummary, reorderLines, type OrderGroup } from "@/lib/order-math";
import { cn } from "@/lib/utils";

// Flags worth a word on the row; everything else is in the detail.
const ROW_FLAGS = ["allergy_mentioned", "complaint", "counteroffer", "capacity_shortfall", "ingredient_shortfall", "new_customer"];
const RISK = new Set(["allergy_mentioned", "complaint"]);

function whatLine(group: OrderGroup): string {
  const { lead, linked } = group;
  if (lead.kind === "reorder") {
    const p = lead.payload as ReorderPayload;
    return `${reorderLines(p).map((l) => l.label).join(", ")} from ${p.supplier}`;
  }
  const reply = lead.payload as ReplyPayload;
  const base = reply.orders.length ? orderSummary(reply) : "Reply only";
  return linked.some((l) => l.kind === "reorder") ? `${base}, plus a restock` : base;
}

export function OrderRow({
  group,
  selected,
  settled,
  onSelect,
}: {
  group: OrderGroup;
  selected: boolean;
  /** Just approved or skipped: the row lingers a moment saying so, then leaves. */
  settled?: "sent" | "skipped";
  onSelect: () => void;
}) {
  const { state } = useStore();
  const { lead } = group;
  const asked = lead.triggerMessageId ? state.messages.find((m) => m.id === lead.triggerMessageId)?.body : undefined;
  const guard = lead.riskFlags.some(isGuardFlag);
  const flags = ROW_FLAGS.filter((f) => lead.riskFlags.includes(f as never)).slice(0, 2);
  const { customerCents, supplierCents } = groupTotals(group);
  const total = customerCents || supplierCents;
  const who = lead.kind === "reorder" && !lead.conversationId ? "Restock" : (lead.customerName ?? "New customer");

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected || undefined}
        className={cn(
          "block w-full px-6 py-4 text-left transition-colors duration-150",
          selected ? "bg-paper" : "hover:bg-paper/60",
          lead.status === "executing" && "ticket-executing",
        )}
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[16px] font-bold text-ink">{who}</span>
          <span className="shrink-0 text-[13px] text-muted tabular">
            {settled === "sent" ? (
              <span className="font-semibold text-terrace">Sent</span>
            ) : settled === "skipped" ? (
              <span className="font-semibold text-muted">Skipped</span>
            ) : lead.status === "executing" ? (
              <span className="font-semibold text-qishr-ink">Sending…</span>
            ) : lead.status === "failed" ? (
              <span className="font-semibold text-qamar">Didn&apos;t send</span>
            ) : (
              shortRelativeTime(lead.createdAt)
            )}
          </span>
        </span>

        {asked && <span className="mt-1 block truncate text-[14px] text-muted">&ldquo;{asked}&rdquo;</span>}

        <span className="mt-1.5 block text-[15px] leading-snug font-medium text-ink line-clamp-2">
          {guard && <Shield className="mr-1.5 mb-0.5 inline size-4 text-qamar" aria-label="Guard caught this" />}
          {lead.rationale}
        </span>

        {total > 0 && (
          <span className="mt-2 flex items-baseline text-[14px] text-ink/80">
            <span className="min-w-0 truncate">{whatLine(group)}</span>
            <span className="leader" aria-hidden />
            <span className="shrink-0 font-semibold text-ink tabular">{money(total)}</span>
          </span>
        )}

        {flags.length > 0 && (
          <span className="mt-1.5 block text-[13px] font-medium text-muted">
            {flags.map((f, i) => (
              <span key={f}>
                {i > 0 && " · "}
                <span className={cn(RISK.has(f) && "font-semibold text-qamar")}>{flagMeta(f).label}</span>
              </span>
            ))}
          </span>
        )}
      </button>
    </li>
  );
}

export function OrderQueue({
  groups,
  selectedId,
  settled,
  onSelect,
  onOpenSim,
  onOpenPerson,
}: {
  groups: OrderGroup[];
  selectedId: string | null;
  settled: Map<string, "sent" | "skipped">;
  onSelect: (p: UiProposal) => void;
  onOpenSim: () => void;
  onOpenPerson: (conversationId: string) => void;
}) {
  const waiting = groups.filter((g) => g.lead.status === "pending").length;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-6 pt-7 pb-4">
        <h1 className="heading text-[34px] text-ink">Orders</h1>
        <p className="mt-1 text-[15px] text-muted">
          {waiting > 0
            ? `${waiting} waiting for you. No order or payment link goes out until you approve it.`
            : "Nothing waiting. No order or payment link goes out until you approve it."}
        </p>
      </div>
      {groups.length === 0 ? (
        <div className="mx-6 mt-2 border-t border-line pt-8">
          <p className="text-[17px] font-semibold text-ink">All caught up.</p>
          <p className="mt-1 max-w-sm text-[15px] text-muted">
            The agent answers simple questions on its own. When someone orders, it checks the order with them first, then it waits here for you.
          </p>
          <button
            type="button"
            onClick={onOpenSim}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-full border border-line-strong px-4 text-[14px] font-semibold text-ink hover:bg-paper"
          >
            <Smartphone className="size-4" /> Text the shop as a customer
          </button>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto border-y border-line">
          {groups.map((g) => (
            <OrderRow
              key={g.lead.id}
              group={g}
              selected={g.lead.id === selectedId}
              settled={settled.get(g.lead.id)}
              onSelect={() => onSelect(g.lead)}
            />
          ))}
        </ul>
      )}
      <WaitingOnCustomer onOpenPerson={onOpenPerson} />
    </div>
  );
}

/**
 * Orders the agent has read back to the customer (items, sizes, allergens, total) and is waiting
 * on a YES for. A YES puts the order in the queue above; nothing is charged before you approve.
 */
function WaitingOnCustomer({ onOpenPerson }: { onOpenPerson: (conversationId: string) => void }) {
  const { state } = useStore();
  const holds = useMemo(() => openHolds(state.events, Date.parse(state.now)), [state.events, state.now]);
  if (holds.length === 0) return null;
  return (
    <section aria-label="Waiting on the customer" className="shrink-0 px-6 pt-5 pb-6">
      <h2 className="text-[15px] font-bold text-ink">Waiting on the customer</h2>
      <p className="mt-0.5 text-[13px] text-muted">The agent read the order back and asked them to reply YES.</p>
      <ul className="mt-2 max-h-48 divide-y divide-line overflow-y-auto">
        {holds.map((h) => {
          const conv = state.conversations.find((c) => c.id === h.conversationId);
          const name = conv?.customerName ?? (conv ? maskHandle(conv.handle) : "Customer");
          return (
            <li key={h.eventId}>
              <button
                type="button"
                onClick={() => onOpenPerson(h.conversationId)}
                className="flex w-full items-baseline gap-3 py-2.5 text-left hover:text-brew"
              >
                <span className="min-w-0 flex-1 truncate text-[14px]">
                  <span className="font-semibold text-ink">{name}</span>
                  <span className="text-muted"> · {h.summary || h.title}</span>
                </span>
                <span className="shrink-0 text-[13px] text-qishr-ink">asked {shortRelativeTime(h.at)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
