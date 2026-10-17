"use client";

import { useMemo, useState } from "react";
import { Ticket } from "@/components/pass/ticket";
import { TicketDrawer } from "@/components/pass/ticket-drawer";
import { DoneStrip } from "@/components/pass/done-strip";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/data/store";
import { toast } from "sonner";

function rotationFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * (i + 1)) % 11;
  return (h - 5) * 0.12;
}

export function PassRail({ onOpenSim }: { onOpenSim: () => void }) {
  const { state, focusProposal, approve, reject } = useStore();
  const [drawerId, setDrawerId] = useState<string | null>(null);

  const pending = useMemo(() => {
    const all = state.proposals.filter((p) =>
      ["pending", "executing", "failed"].includes(p.status),
    );
    const parents = all.filter((p) => !p.parentProposalId);
    const children = all.filter((p) => p.parentProposalId);
    const ordered: typeof all = [];
    for (const parent of parents) {
      ordered.push(parent);
      ordered.push(...children.filter((c) => c.parentProposalId === parent.id));
    }
    for (const orphan of children) {
      if (!ordered.includes(orphan)) ordered.push(orphan);
    }
    return ordered.slice(0, 6);
  }, [state.proposals]);

  const done = useMemo(
    () =>
      state.proposals
        .filter((p) => p.status === "executed" || p.status === "rejected")
        .slice(0, 8),
    [state.proposals],
  );

  const drawerProposal =
    state.proposals.find((p) => p.id === drawerId) ??
    done.find((p) => p.id === drawerId) ??
    null;

  const hidden = Math.max(
    0,
    state.proposals.filter((p) => p.status === "pending").length - 6,
  );

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col border-x border-line bg-panel/40 pass-grain">
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <h2 className="font-mono text-[12px] tracking-[0.2em] text-muted uppercase">
          The Pass
        </h2>
        <span className="font-mono text-[12px] text-amber">
          {state.proposals.filter((p) => p.status === "pending").length} pending
          {hidden > 0 ? ` · +${hidden} more` : ""}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {pending.length === 0 ? (
          <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-[8px] border border-dashed border-line bg-bg/40 px-6 text-center">
            <div className="mb-3 h-16 w-40 rounded-[6px] border border-line/80 bg-ticket/10 shadow-inner" />
            <p className="max-w-sm text-[15px] text-fg">
              Quiet at the pass. Text the shop to see agents work.
            </p>
            <Button className="mt-4" variant="outline" onClick={onOpenSim}>
              Open phone simulator
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
            {pending.map((proposal) => {
              const isParent = !proposal.parentProposalId;
              const children = pending.filter(
                (c) => c.parentProposalId === proposal.id,
              );
              const linked = Boolean(proposal.parentProposalId) || children.length > 0;

              return (
                <div
                  key={proposal.id}
                  className={
                    isParent && children.length > 0
                      ? "xl:col-span-2 relative"
                      : undefined
                  }
                >
                  {isParent && children.length > 0 ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="relative">
                        <div className="pointer-events-none absolute top-8 -right-2 z-20 hidden h-0.5 w-4 bg-amber/70 md:block" />
                        <Ticket
                          proposal={proposal}
                          focused={state.focusedProposalId === proposal.id}
                          linked
                          rotation={rotationFor(proposal.id)}
                          onFocus={() => focusProposal(proposal.id)}
                          onOpen={() => setDrawerId(proposal.id)}
                          onApprove={() =>
                            void approve(proposal.id).catch((e) =>
                              toast.error(e.message),
                            )
                          }
                          onReject={() =>
                            void reject(proposal.id).catch((e) =>
                              toast.error(e.message),
                            )
                          }
                          onApproveBoth={() =>
                            void approve(proposal.id, { includeLinked: true })
                              .then(() => toast.success("Approved both"))
                              .catch((e) => toast.error(e.message))
                          }
                          onRejectBoth={() =>
                            void reject(proposal.id, { includeLinked: true })
                              .then(() => toast.message("Rejected both"))
                              .catch((e) => toast.error(e.message))
                          }
                        />
                      </div>
                      {children.map((child) => (
                        <Ticket
                          key={child.id}
                          proposal={child}
                          focused={state.focusedProposalId === child.id}
                          linked
                          rotation={rotationFor(child.id)}
                          onFocus={() => focusProposal(child.id)}
                          onOpen={() => setDrawerId(child.id)}
                          onApprove={() =>
                            void approve(child.id).catch((e) =>
                              toast.error(e.message),
                            )
                          }
                          onReject={() =>
                            void reject(child.id).catch((e) =>
                              toast.error(e.message),
                            )
                          }
                        />
                      ))}
                    </div>
                  ) : proposal.parentProposalId ? null : (
                    <Ticket
                      proposal={proposal}
                      focused={state.focusedProposalId === proposal.id}
                      linked={linked}
                      rotation={rotationFor(proposal.id)}
                      onFocus={() => focusProposal(proposal.id)}
                      onOpen={() => setDrawerId(proposal.id)}
                      onApprove={() =>
                        void approve(proposal.id).catch((e) =>
                          toast.error(e.message),
                        )
                      }
                      onReject={() =>
                        void reject(proposal.id).catch((e) =>
                          toast.error(e.message),
                        )
                      }
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        <DoneStrip tickets={done} onOpen={(id) => setDrawerId(id)} />

        <p className="mt-4 font-mono text-[11px] text-muted">
          A approve · E edit · R reject · J/K focus · S simulator · ? help
        </p>
      </div>

      <TicketDrawer
        proposal={drawerProposal}
        open={Boolean(drawerId)}
        onOpenChange={(o) => {
          if (!o) setDrawerId(null);
        }}
      />
    </section>
  );
}
