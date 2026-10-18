"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { OrderDetail } from "@/components/orders/order-detail";
import { OrderQueue } from "@/components/orders/order-queue";
import { useStore } from "@/lib/data/store";
import type { UiProposal } from "@/lib/data/types";
import { groupTickets } from "@/lib/order-math";

const ACTIVE = new Set(["pending", "executing", "failed"]);
/** How long a just-decided row stays in the queue saying "Sent" or "Skipped". */
const SETTLE_MS = 1400;

/** Rows that just left "pending", held briefly so the owner sees the result land. */
function useSettled(proposals: UiProposal[]) {
  const last = useRef(new Map<string, string>());
  const [settled, setSettled] = useState<Map<string, "sent" | "skipped">>(() => new Map());
  useEffect(() => {
    const hits: [string, "sent" | "skipped"][] = [];
    for (const p of proposals) {
      const prev = last.current.get(p.id);
      if (prev && ACTIVE.has(prev) && (p.status === "executed" || p.status === "rejected")) {
        hits.push([p.id, p.status === "executed" ? "sent" : "skipped"]);
      }
      last.current.set(p.id, p.status);
    }
    if (hits.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirrors an external status change; cleared by the timer
    setSettled((m) => new Map([...m, ...hits]));
    const t = setTimeout(() => setSettled((m) => {
      const next = new Map(m);
      for (const [id] of hits) next.delete(id);
      return next;
    }), SETTLE_MS);
    return () => clearTimeout(t);
  }, [proposals]);
  return settled;
}

export function OrdersView({
  onOpenSim,
  onOpenPerson,
  blocked,
}: {
  onOpenSim: () => void;
  onOpenPerson: (conversationId: string) => void;
  /** A dialog or the simulator has the keyboard. */
  blocked: boolean;
}) {
  const { state, focusProposal, approve, reject } = useStore();
  const settled = useSettled(state.proposals);
  const detailRef = useRef<HTMLElement>(null);
  const pick = (id: string) => {
    focusProposal(id);
    // Stacked on a phone, the detail sits under the queue: bring it up so the tap visibly did something.
    if (window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  const groups = useMemo(
    () => groupTickets(state.proposals, (p) => ACTIVE.has(p.status) || settled.has(p.id)),
    [state.proposals, settled],
  );
  const selected = groups.find((g) => g.lead.id === state.focusedProposalId) ?? groups.find((g) => g.lead.status === "pending") ?? groups[0];

  useEffect(() => {
    if (blocked) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || e.metaKey || e.ctrlKey || e.altKey) return;
      const pending = groups.filter((g) => g.lead.status === "pending");
      const idx = pending.findIndex((g) => g.lead.id === selected?.lead.id);
      if (e.key === "j" || e.key === "J" || e.key === "ArrowDown") {
        const next = pending[Math.min(pending.length - 1, idx + 1)];
        if (next) {
          e.preventDefault();
          focusProposal(next.lead.id);
        }
      }
      if (e.key === "k" || e.key === "K" || e.key === "ArrowUp") {
        const prev = pending[Math.max(0, idx - 1)];
        if (prev) {
          e.preventDefault();
          focusProposal(prev.lead.id);
        }
      }
      if (!selected || selected.lead.status !== "pending") return;
      const includeLinked = selected.linked.length > 0;
      if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        void approve(selected.lead.id, { includeLinked })
          .then(() => toast.success(includeLinked ? "Reply sent and restock ordered" : "Approved"))
          .catch((err: Error) => toast.error(err.message));
      }
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        void reject(selected.lead.id, { includeLinked })
          .then(() => toast.message("Skipped"))
          .catch((err: Error) => toast.error(err.message));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [blocked, groups, selected, focusProposal, approve, reject]);

  return (
    <div id="view-orders" role="tabpanel" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
      <section className="flex shrink-0 flex-col lg:w-[40%] lg:max-w-[560px] lg:min-w-[360px]">
        <OrderQueue
          groups={groups}
          selectedId={selected?.lead.id ?? null}
          settled={settled}
          onSelect={(p) => pick(p.id)}
          onOpenSim={onOpenSim}
        />
      </section>
      <section ref={detailRef} className="flex min-h-[70dvh] min-w-0 flex-1 scroll-mt-0 border-t border-line lg:min-h-0 lg:border-t-0 lg:border-l">
        {selected ? (
          // Keyed by ticket so an edit or a half-written message never carries over to the next order.
          <OrderDetail key={selected.lead.id} group={selected} onOpenPerson={onOpenPerson} />
        ) : (
          <div className="flex flex-1 items-center justify-center bg-paper px-8 text-center text-[15px] text-muted">
            {groups.length === 0
              ? "Nothing to review. New orders open here with the conversation, the reply, and how the agents got there."
              : "Pick an order on the left to see the conversation, the reply, and how the agents got there."}
          </div>
        )}
      </section>
    </div>
  );
}
