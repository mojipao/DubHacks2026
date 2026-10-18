"use client";

import { useMemo } from "react";
import { Hourglass } from "lucide-react";
import { useStore } from "@/lib/data/store";
import { openHolds } from "@/lib/data/derive";
import { maskHandle, shortRelativeTime } from "@/lib/format";

/**
 * Orders the agent has checked with the customer (items, sizes, allergens, total) and is waiting
 * on a YES or NO for. A YES puts the order on the pass for approval; nothing is charged before then.
 */
export function HoldStrip() {
  const { state, selectConversation } = useStore();
  const holds = useMemo(() => openHolds(state.events, Date.parse(state.now)), [state.events, state.now]);
  if (holds.length === 0) return null;

  return (
    <section aria-label="Waiting on the customer" className="mb-4 rounded-[22px] border border-line bg-surface-2/50 px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <Hourglass className="size-3.5 text-amber" aria-hidden />
        <span className="eyebrow">Waiting on the customer</span>
        <span className="font-mono text-[11px] text-muted">{holds.length}</span>
      </div>
      <ul className="space-y-1.5">
        {holds.map((h) => {
          const conv = state.conversations.find((c) => c.id === h.conversationId);
          const name = conv?.customerName ?? (conv ? maskHandle(conv.handle) : "Customer");
          return (
            <li key={h.eventId}>
              <button
                type="button"
                onClick={() => selectConversation(h.conversationId)}
                className="flex w-full items-baseline justify-between gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-surface-2"
              >
                <span className="min-w-0">
                  <span className="text-[14px] font-medium text-fg">{name}</span>
                  <span className="ml-2 text-[13px] text-muted">{h.summary || h.title}</span>
                </span>
                <span className="shrink-0 font-mono text-[11px] text-muted">asked {shortRelativeTime(h.at)} · reply YES/NO</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
