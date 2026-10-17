"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Link2 } from "lucide-react";
import { Ticket } from "@/components/pass/ticket";
import { TicketDrawer } from "@/components/pass/ticket-drawer";
import { DoneStrip } from "@/components/pass/done-strip";
import { EmptyPass } from "@/components/pass/empty-pass";
import { useStore } from "@/lib/data/store";
import type { UiProposal } from "@/lib/data/types";
import { toast } from "sonner";

const MAX_VISIBLE = 6;
/** How long a just-approved or just-rejected ticket stays on the rail so its stamp can land. */
const STAMP_HOLD_MS = 1600;
const ACTIVE = new Set(["pending", "executing", "failed"]);

function rotationFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * (i + 1)) % 11;
  return (h - 5) * 0.12;
}

/** Tickets that were on the rail and just got decided, kept briefly for the stamp animation. */
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
    // Syncing derived UI state from an external change; the timeout below clears it.
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
}: {
  onOpenSim: () => void;
  drawer: DrawerTarget;
  onDrawer: (target: DrawerTarget) => void;
}) {
  const { state, focusProposal, approve, reject, retry } = useStore();
  const reduce = useReducedMotion();
  const setDrawerId = (id: string | null) => onDrawer(id ? { id, editing: false } : null);
  const drawerId = drawer?.id ?? null;
  const held = useStampHold(state.proposals);

  const onRail = useMemo(
    () => state.proposals.filter((p) => ACTIVE.has(p.status) || held.has(p.id)),
    [state.proposals, held],
  );

  // Group each parent with its children so a counteroffer and its reorder hang together.
  const groups = useMemo(() => {
    const byParent = new Map<string, UiProposal[]>();
    for (const p of onRail) {
      if (!p.parentProposalId) continue;
      byParent.set(p.parentProposalId, [...(byParent.get(p.parentProposalId) ?? []), p]);
    }
    const ids = new Set(onRail.map((p) => p.id));
    const out: { parent: UiProposal; children: UiProposal[] }[] = [];
    for (const p of onRail) {
      if (p.parentProposalId && ids.has(p.parentProposalId)) continue;
      out.push({ parent: p, children: byParent.get(p.id) ?? [] });
    }
    return out;
  }, [onRail]);

  let shown = 0;
  const visibleGroups = groups.filter((g) => {
    if (shown >= MAX_VISIBLE) return false;
    shown += 1 + g.children.length;
    return true;
  });
  const pendingCount = state.proposals.filter((p) => p.status === "pending").length;
  const hiddenCount = groups
    .slice(visibleGroups.length)
    .reduce((n, g) => n + 1 + g.children.length, 0);

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

  const handlers = (p: UiProposal) => ({
    onFocus: () => focusProposal(p.id),
    onOpen: () => setDrawerId(p.id),
    onApprove: () =>
      void approve(p.id)
        .then(() => toast.success(p.kind === "reorder" ? "Reorder placed" : "Sent"))
        .catch((e: Error) => toast.error(e.message)),
    onReject: () =>
      void reject(p.id)
        .then(() => toast.message("86'd"))
        .catch((e: Error) => toast.error(e.message)),
    onRetry: () =>
      void retry(p.id)
        .then(() => toast.success("Retried"))
        .catch((e: Error) => toast.error(e.message)),
  });

  const ticket = (p: UiProposal, extra?: Partial<Parameters<typeof Ticket>[0]>) => (
    <Ticket
      proposal={p}
      focused={state.focusedProposalId === p.id}
      rotation={rotationFor(p.id)}
      {...handlers(p)}
      {...extra}
    />
  );

  return (
    <section className="surface relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl">
      {/* Warm work light over the rail. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,rgba(245,177,76,0.08),transparent)]" />
      <div className="relative flex items-center justify-between px-5 pt-3.5 pb-1">
        <h2 className="eyebrow">The pass</h2>
        <span className="font-mono text-[12px] text-muted">
          {pendingCount} pending
          {hiddenCount > 0 ? ` · +${hiddenCount} more` : ""}
        </span>
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto px-5 pt-2 pb-4">
        {/* The rail itself: a brushed steel bar the tickets hang from. */}
        <div className="mb-5 h-[5px] rounded-full bg-gradient-to-b from-[#6b645d] via-[#3b3733] to-[#24211f] shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_3px_8px_rgba(0,0,0,0.6)]" />

        {visibleGroups.length === 0 ? (
          state.loaded ? (
            <EmptyPass onOpenSim={onOpenSim} />
          ) : null
        ) : (
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2 min-[1400px]:grid-cols-3">
            <AnimatePresence mode="popLayout" initial={false}>
              {visibleGroups.map(({ parent, children }) => (
                <motion.div
                  key={parent.id}
                  layout={!reduce}
                  exit={reduce ? { opacity: 0 } : { x: 160, opacity: 0, transition: { duration: 0.35 } }}
                  className={children.length > 0 ? "lg:col-span-2" : undefined}
                >
                  {children.length > 0 ? (
                    <div className="relative">
                      <div className="mb-2.5 flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-amber/90 uppercase">
                        <Link2 className="size-3.5" />
                        Linked · one decision
                        <span className="h-px flex-1 bg-gradient-to-r from-amber/40 to-transparent" />
                      </div>
                      {/* Rail clip: one bar spanning the pair, so they read as one decision. */}
                      <div className="pointer-events-none absolute top-[27px] right-8 left-8 z-20 hidden h-[3px] rounded-full bg-amber shadow-[0_0_12px_rgba(245,177,76,0.5)] md:block" />
                      <div className="grid gap-3 md:grid-cols-2">
                        {ticket(parent, {
                          onApproveBoth: () =>
                            void approve(parent.id, { includeLinked: true })
                              .then(() => toast.success("Approved both: reply sent, reorder placed"))
                              .catch((e: Error) => toast.error(e.message)),
                          onRejectBoth: () =>
                            void reject(parent.id, { includeLinked: true })
                              .then(() => toast.message("86'd both"))
                              .catch((e: Error) => toast.error(e.message)),
                        })}
                        {children.map((child) => (
                          <div key={child.id}>{ticket(child)}</div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    ticket(parent)
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        <DoneStrip tickets={done} onOpen={(id) => setDrawerId(id)} />

        <p className="mt-5 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-muted">
          {[["A", "approve"], ["E", "edit"], ["R", "reject"], ["J/K", "focus"], ["S", "simulator"], ["?", "help"]].map(([k, v]) => (
            <span key={k}>
              <kbd className="rounded border border-line-strong bg-surface-2 px-1 text-fg/80">{k}</kbd> {v}
            </span>
          ))}
        </p>
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
