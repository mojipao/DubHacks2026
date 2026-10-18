"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Ticket } from "@/components/pass/ticket";
import { TicketDrawer } from "@/components/pass/ticket-drawer";
import { DoneStrip } from "@/components/pass/done-strip";
import { HoldStrip } from "@/components/pass/hold-strip";
import { agentSentProposalIds } from "@/lib/data/derive";
import { EmptyPass } from "@/components/pass/empty-pass";
import { useStore } from "@/lib/data/store";
import type { UiProposal } from "@/lib/data/types";
import { toast } from "sonner";

const MAX_VISIBLE = 8;
const STAMP_HOLD_MS = 1600;
const ACTIVE = new Set(["pending", "executing", "failed"]);

function useStampHold(proposals: UiProposal[]) {
  const lastStatus = useRef(new Map<string, string>());
  const [held, setHeld] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const newlyDecided: string[] = [];
    for (const p of proposals) {
      const prev = lastStatus.current.get(p.id);
      if (prev && ACTIVE.has(prev) && (p.status === "executed" || p.status === "rejected")) {
        newlyDecided.push(p.id);
      }
      lastStatus.current.set(p.id, p.status);
    }
    if (newlyDecided.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHeld((s) => new Set([...s, ...newlyDecided]));
    const t = setTimeout(() => {
      setHeld((s) => {
        const next = new Set(s);
        for (const id of newlyDecided) next.delete(id);
        return next;
      });
    }, STAMP_HOLD_MS);
    return () => clearTimeout(t);
  }, [proposals]);

  return held;
}

export type DrawerTarget = { id: string; editing: boolean } | null;

export function PassRail({
  onOpenSim,
  drawer,
  onDrawer,
  compact,
}: {
  onOpenSim: () => void;
  drawer: DrawerTarget;
  onDrawer: (target: DrawerTarget) => void;
  /** Side panel next to messages — tighter header. */
  compact?: boolean;
}) {
  const { state, focusProposal, selectConversation, approve, reject, retry } = useStore();
  const reduce = useReducedMotion();
  const setDrawerId = (id: string | null) => onDrawer(id ? { id, editing: false } : null);
  const drawerId = drawer?.id ?? null;
  const held = useStampHold(state.proposals);

  // Flat list: reply and restock are separate tickets, never a paired card.
  const onRail = useMemo(() => {
    const items = state.proposals.filter((p) => ACTIVE.has(p.status) || held.has(p.id));
    return items.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [state.proposals, held]);

  const visible = onRail.slice(0, MAX_VISIBLE);
  const pendingCount = state.proposals.filter((p) => p.status === "pending").length;
  const hiddenCount = Math.max(0, onRail.length - visible.length);

  const done = useMemo(
    () =>
      state.proposals
        .filter((p) => (p.status === "executed" || p.status === "rejected") && !held.has(p.id))
        .sort(
          (a, b) =>
            Date.parse(b.executedAt ?? b.decidedAt ?? b.createdAt) -
            Date.parse(a.executedAt ?? a.decidedAt ?? a.createdAt),
        )
        .slice(0, 8),
    [state.proposals, held],
  );

  const drawerProposal = state.proposals.find((p) => p.id === drawerId) ?? null;

  const focusTicket = (p: UiProposal) => {
    focusProposal(p.id);
    if (p.conversationId) selectConversation(p.conversationId);
  };

  const handlers = (p: UiProposal) => ({
    onFocus: () => focusTicket(p),
    onOpen: () => {
      focusTicket(p);
      setDrawerId(p.id);
    },
    onApprove: () =>
      void approve(p.id)
        .then(() => toast.success(p.kind === "reorder" ? "Reorder placed" : "Sent"))
        .catch((e: Error) => toast.error(e.message)),
    onReject: () =>
      void reject(p.id)
        .then(() => toast.message("Skipped"))
        .catch((e: Error) => toast.error(e.message)),
    onRetry: () =>
      void retry(p.id)
        .then(() => toast.success("Retried"))
        .catch((e: Error) => toast.error(e.message)),
  });

  return (
    <section className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className={cnHeader(compact)}>
        <div>
          <h1 className={compact ? "heading text-[28px] text-fg" : "heading text-[40px] text-fg md:text-[44px]"}>
            Waiting for you
          </h1>
          <p className="mt-2 max-w-[36ch] text-[15px] leading-relaxed text-muted">
            The agent answers simple questions itself and checks each order with the customer first. Orders and payments wait for you.
          </p>
        </div>
        <span className="text-[13px] tracking-wide text-muted">
          {pendingCount} waiting
          {hiddenCount > 0 ? ` · ${hiddenCount} more` : ""}
        </span>
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <HoldStrip />
        {visible.length === 0 ? (
          state.loaded ? (
            <EmptyPass onOpenSim={onOpenSim} />
          ) : null
        ) : (
          <div className="flex flex-col">
            <AnimatePresence mode="popLayout" initial={false}>
              {visible.map((p) => (
                <motion.div
                  key={p.id}
                  layout={!reduce}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, transition: { duration: 0.25 } }}
                >
                  <Ticket
                    proposal={p}
                    focused={state.focusedProposalId === p.id}
                    {...handlers(p)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        <div className="mt-6">
          <DoneStrip tickets={done} onOpen={(id) => setDrawerId(id)} agentSent={agentSentProposalIds(state.events)} />
        </div>
      </div>

      <TicketDrawer
        key={drawer ? `${drawer.id}:${drawer.editing}` : "closed"}
        proposal={drawerProposal}
        open={Boolean(drawerId)}
        startEditing={drawer?.editing}
        onOpenChange={(o) => {
          if (!o) setDrawerId(null);
        }}
      />
    </section>
  );
}

function cnHeader(compact?: boolean) {
  return compact
    ? "mb-2 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4"
    : "mb-4 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6";
}
