"use client";

import { PAYMENT_LINK_TOKEN, type ReplyPayload, type ReorderPayload } from "@boh/shared";
import { motion, useReducedMotion } from "motion/react";
import { Shield } from "lucide-react";
import { EvidenceChip } from "@/components/pass/evidence-chip";
import { RiskChip } from "@/components/pass/risk-chip";
import { Stamp } from "@/components/pass/stamp";
import { Button } from "@/components/ui/button";
import { INGREDIENT_NAMES, PRODUCT_NAMES } from "@/lib/business";
import type { UiProposal } from "@/lib/data/types";
import { isGuardFlag } from "@/lib/flags";
import { friendlyPickup, shortRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

// Tickets are paper, so their buttons need paper colors rather than the dark shadcn defaults.
const TICKET_APPROVE = "rounded-full bg-ink px-3.5 font-semibold text-ticket hover:bg-ink/85";
const TICKET_SECONDARY = "rounded-full border-ink/20 bg-transparent px-3 font-semibold text-ink hover:bg-ink/5 hover:text-ink";
const TICKET_REJECT = "rounded-full border-transparent bg-transparent px-3 font-semibold text-[#a3341a] hover:bg-tomato/10 hover:text-[#a3341a]";

const AGENT_STRIPE: Record<string, string> = {
  intake: "bg-sky",
  ops: "bg-amber",
  winback: "bg-basil",
  guard: "bg-tomato",
};

function ConfidenceMeter({ value }: { value: number }) {
  const filled = Math.round(value * 5);
  return (
    <div className="flex gap-0.5" aria-label={`Confidence ${Math.round(value * 100)}%`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 w-2.5 rounded-[1px]",
            i < filled
              ? value < 0.6
                ? "bg-[#c77a12]"
                : "bg-ink/75"
              : "bg-ink/12",
          )}
        />
      ))}
    </div>
  );
}

function readsSummary(reads: UiProposal["reads"]): string {
  const counts = new Map<string, number>();
  for (const r of reads) {
    counts.set(r.table, (counts.get(r.table) ?? 0) + 1);
  }
  const parts = [...counts.entries()].map(([table, n]) => {
    if (table === "orders") return `${n} order${n === 1 ? "" : "s"}`;
    if (table === "capacity") return `${n} day${n === 1 ? "" : "s"} of capacity`;
    if (table === "ingredients") return `${n} ingredient${n === 1 ? "" : "s"}`;
    if (table === "customers") return `${n} customer${n === 1 ? "" : "s"}`;
    return `${n} ${table}`;
  });
  return parts.length ? `read ${parts.join(" · ")}` : "no records logged";
}

export function Ticket({
  proposal,
  focused,
  rotation,
  onFocus,
  onOpen,
  onApprove,
  onReject,
  onApproveBoth,
  onRejectBoth,
  onRetry,
}: {
  proposal: UiProposal;
  focused: boolean;
  rotation: number;
  onFocus: () => void;
  onOpen: () => void;
  onApprove: () => void;
  onReject: () => void;
  onApproveBoth?: () => void;
  onRejectBoth?: () => void;
  onRetry?: () => void;
}) {
  const reduce = useReducedMotion();
  const isReply = proposal.kind === "reply";
  const reply = isReply ? (proposal.payload as ReplyPayload) : null;
  const reorder = !isReply ? (proposal.payload as ReorderPayload) : null;
  const guardFlags = proposal.riskFlags.filter(isGuardFlag);
  const evidencePreview = proposal.evidence.slice(0, 4);
  const more = Math.max(0, proposal.evidence.length - 4);

  return (
    <motion.article
      layout
      initial={reduce ? false : { y: -28, opacity: 0 }}
      animate={{ y: 0, opacity: 1, rotate: focused ? 0 : rotation }}
      whileHover={reduce ? undefined : { rotate: 0, y: -2 }}
      transition={{ type: "spring", stiffness: 380, damping: 22, mass: 0.7 }}
      onClick={onFocus}
      onDoubleClick={onOpen}
      className={cn(
        "ticket-paper ticket-shadow relative w-full overflow-hidden rounded-[8px]",
        focused && "ring-2 ring-amber ring-offset-2 ring-offset-bg",
        proposal.status === "executing" && "ticket-executing",
        proposal.status === "failed" && "ring-2 ring-tomato",
      )}
    >
      {/* Agent stripe: the only strong color on the paper, so a glance tells you who drafted it. */}
      <div className={cn("h-1 w-full", AGENT_STRIPE[guardFlags.length > 0 ? "guard" : proposal.agent])} />
      <div className="flex items-center justify-between gap-2 border-b border-dashed border-ink/15 px-3.5 pt-2.5 pb-2">
        <span className="flex min-w-0 items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.12em] uppercase">
          <span className={cn("size-1.5 shrink-0 rounded-full", AGENT_STRIPE[proposal.agent])} />
          <span className="whitespace-nowrap text-ink/55">
            {proposal.agent}
            <span className="hidden min-[1400px]:inline"> · {proposal.kind}</span>
          </span>
          <span className="truncate text-ink">{proposal.customerName ?? "Unknown"}</span>
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-mono text-[10px] whitespace-nowrap text-ink/50">
            {shortRelativeTime(proposal.createdAt)}
          </span>
          <ConfidenceMeter value={proposal.confidence} />
        </div>
      </div>

      {(proposal.status === "executed" ||
        proposal.approvedVia === "imessage") && (
        <Stamp
          kind={proposal.approvedVia === "imessage" ? "text" : "sent"}
          viaText={proposal.approvedVia === "imessage"}
          delay={proposal.parentProposalId ? 0.35 : 0}
        />
      )}
      {proposal.status === "rejected" && (
        <Stamp kind="rejected" delay={proposal.parentProposalId ? 0.35 : 0} />
      )}

      <div className="space-y-3 px-3.5 py-3 text-ink">
        <div className="flex flex-wrap items-start gap-2">
          <p className="min-w-0 flex-1 text-[15.5px] leading-snug font-semibold tracking-[-0.01em]">
            {proposal.rationale}
          </p>
          {proposal.riskFlags.includes("counteroffer") && (
            <span className="shrink-0 rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold tracking-wider text-amber uppercase">
              Counteroffer
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="font-mono text-[12px] text-ink/65 underline-offset-2 hover:underline"
        >
          {readsSummary(proposal.reads)}
        </button>

        {proposal.riskFlags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {proposal.riskFlags.map((f) => (
              <RiskChip key={f} flag={f} />
            ))}
          </div>
        )}

        {guardFlags.length > 0 && (
          <div className="flex gap-2 rounded-md bg-[#2a1712] px-3 py-2.5 text-[13px] leading-snug text-[#ffd9cc] ring-1 ring-tomato/50">
            <span className="sr-only">Guard:</span>
            <Shield className="mt-0.5 size-4 shrink-0 text-tomato" />
            <p>
              {proposal.guardSummary ??
                "Guard flagged this draft. Reply declines; no order."}
            </p>
          </div>
        )}

        {reply && (
          <div className="space-y-2">
            <p className="whitespace-pre-wrap font-mono text-[12.5px] leading-relaxed text-ink/85">
              {reply.text.split(PAYMENT_LINK_TOKEN).map((chunk, i, arr) => (
                <span key={i}>
                  {chunk}
                  {i < arr.length - 1 && (
                    <span
                      className="mx-0.5 inline-flex rounded-full bg-[#dce9fb] px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-[#1f4f87]"
                      title="The server creates the Square payment link when you approve"
                    >
                      Square link · on approve
                    </span>
                  )}
                </span>
              ))}
            </p>
            {reply.orders.map((order, idx) => (
              <div
                key={idx}
                className="rounded-md border border-ink/10 bg-ink/[0.035] px-2.5 py-1.5 font-mono text-[12px]"
              >
                <div className="font-semibold">
                  {friendlyPickup(order.pickupAt)}
                </div>
                {order.items.map((item) => (
                  <div key={item.productId}>
                    {item.qty}× {PRODUCT_NAMES[item.productId] ?? item.productId}
                  </div>
                ))}
                {order.perk === "welcome_back_10" && (
                  <div className="text-[#1f7a4a]">Perk: welcome back 10%</div>
                )}
              </div>
            ))}
          </div>
        )}

        {reorder && (
          <div className="rounded-md border border-ink/10 bg-ink/[0.035] px-2.5 py-1.5 font-mono text-[12px]">
            <div className="font-semibold">{reorder.supplier}</div>
            {reorder.lines.map((line) => (
              <div key={line.ingredientId}>
                {line.qty} {INGREDIENT_NAMES[line.ingredientId]?.unit ?? "u"}{" "}
                {INGREDIENT_NAMES[line.ingredientId]?.name ?? line.ingredientId}
              </div>
            ))}
            {reorder.neededBy && (
              <div className="text-ink/60">
                needed by {friendlyPickup(reorder.neededBy)}
              </div>
            )}
            <div className="mt-1 text-[11px] text-ink/50">simulated supplier</div>
          </div>
        )}

        {evidencePreview.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {evidencePreview.map((e) => (
              <EvidenceChip
                key={`${e.label}-${e.value}`}
                label={e.label}
                value={e.value}
                onClick={() => onOpen()}
              />
            ))}
            {more > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen();
                }}
                className="text-[12px] font-semibold text-ink/60"
              >
                +{more} more
              </button>
            )}
          </div>
        )}

        {proposal.status === "executing" && (
          <p className="font-mono text-[12px] font-semibold text-[#8a5a12]">Sending…</p>
        )}

        {proposal.status === "failed" && (
          <div
            className="flex flex-wrap items-center justify-between gap-2 rounded-[4px] border border-tomato/40 bg-tomato/10 px-2.5 py-2"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="min-w-0 flex-1 text-[13px] font-semibold text-[#9c2f12]">
              {proposal.error ?? "Execution failed"}
            </p>
            {onRetry && (
              <Button size="sm" className={TICKET_REJECT} variant="outline" onClick={onRetry}>
                Retry
              </Button>
            )}
          </div>
        )}

        {proposal.status === "pending" && (
          <div
            className="flex flex-wrap gap-1.5 pt-1"
            onClick={(e) => e.stopPropagation()}
          >
            {onApproveBoth ? (
              <>
                <Button size="sm" className={TICKET_APPROVE} onClick={onApproveBoth}>
                  Approve both
                </Button>
                <Button size="sm" variant="outline" className={TICKET_REJECT} onClick={onRejectBoth}>
                  Reject both
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" className={TICKET_APPROVE} onClick={onApprove}>
                  Approve
                </Button>
                <Button size="sm" variant="outline" className={TICKET_SECONDARY} onClick={onOpen}>
                  Edit
                </Button>
                <Button size="sm" variant="outline" className={TICKET_REJECT} onClick={onReject}>
                  Reject
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </motion.article>
  );
}
