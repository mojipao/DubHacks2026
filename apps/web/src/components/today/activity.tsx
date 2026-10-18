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
    <section className="border-t border-line/40 pt-6">
      <h2 className="heading text-[15px] text-muted">What just happened</h2>
      {lines.length === 0 ? (
        <p className="mt-3 text-[14px] text-muted">Nothing yet today.</p>
      ) : (
        <ol className="mt-3 space-y-2.5">
          {lines.map((l) => (
            <li key={l.id} className="flex items-center gap-3">
              <span
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  l.tone === "basil" && "bg-basil",
                  l.tone === "cherry" && "bg-cherry",
                  l.tone === "sky" && "bg-sky",
                  l.tone === "crema" && "bg-crema",
                  l.tone === "fg" && "bg-fg/50",
                )}
              />
              <span className="min-w-0 flex-1 truncate text-[14px] text-fg">{l.text}</span>
              <span className="shrink-0 text-[12px] text-muted">{shortRelativeTime(l.at)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
