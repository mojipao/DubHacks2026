"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/data/store";
import type { UiEvent } from "@/lib/data/types";
import { maskHandle, shortRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Line = { id: string; at: string; text: string; tone: "fg" | "basil" | "cherry" | "sky" | "crema" };

/** The audit log in plain words: what happened, not event names. Agent steps are left to the trace. */
export function Activity({ limit = 8 }: { limit?: number }) {
  const { state } = useStore();

  const lines = useMemo(() => {
    const convName = (id: unknown) => {
      const c = state.conversations.find((x) => x.id === id);
      if (!c) return "A customer";
      if (c.role === "owner") return "You";
      return c.customerName?.split(" ")[0] ?? maskHandle(c.handle);
    };
    const kindOf = (id: string | null) => state.proposals.find((p) => p.id === id)?.kind;
    const say = (e: UiEvent): Omit<Line, "id" | "at"> | null => {
      switch (e.type) {
        case "message.received":
          return { text: `${convName(e.data.conversationId)} texted the shop`, tone: "sky" };
        case "proposal.created":
          return { text: `Agents drafted a ${kindOf(e.subjectId) === "reorder" ? "restock" : "reply"}`, tone: "fg" };
        case "guard.flagged":
          return { text: "Guard caught a risky message", tone: "cherry" };
        case "proposal.approved":
          return { text: e.data.via === "imessage" ? "Approved by text from your phone" : "You approved a ticket", tone: "basil" };
        case "proposal.rejected":
          return { text: "You skipped a ticket", tone: "fg" };
        case "message.sent":
          return { text: "Reply sent", tone: "basil" };
        case "order.created":
          return { text: "Order created, waiting for payment", tone: "crema" };
        case "order.paid":
          return { text: "Order paid", tone: "basil" };
        case "inventory.reordered":
          return { text: "Restock ordered from the supplier", tone: "crema" };
        case "inventory.received":
          return { text: "Supplier delivery received", tone: "crema" };
        default:
          return null;
      }
    };
    const out: Line[] = [];
    for (const e of state.events) {
      const l = say(e);
      // A split counteroffer pays two orders at once; one line says it.
      if (l && out.at(-1)?.text !== l.text) out.push({ id: e.id, at: e.at, ...l });
      if (out.length >= limit) break;
    }
    return out;
  }, [state.events, state.conversations, state.proposals, limit]);

  return (
    <section>
      <h2 className="mb-3 text-[20px] font-bold text-ink">What happened</h2>
      {lines.length === 0 ? (
        <p className="border-t border-line py-4 text-[15px] text-muted">Nothing yet today.</p>
      ) : (
        <ol className="divide-y divide-line border-t border-line">
          {lines.map((l) => (
            <li key={l.id} className="grid grid-cols-[4.75rem_1fr] gap-x-4 py-2.5 text-[15px]">
              <span className="text-[14px] text-muted tabular">{shortRelativeTime(l.at)}</span>
              <span className={cn("min-w-0 truncate", l.tone === "cherry" ? "font-semibold text-qamar" : l.tone === "basil" ? "text-terrace" : "text-ink")}>
                {l.text}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
