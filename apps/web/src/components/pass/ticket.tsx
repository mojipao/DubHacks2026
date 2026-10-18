"use client";

import type { ReplyPayload, ReorderPayload } from "@boh/shared";
import { motion, useReducedMotion } from "motion/react";
import { Shield } from "lucide-react";
import { RiskChip } from "@/components/pass/risk-chip";
import { Stamp } from "@/components/pass/stamp";
import { INGREDIENT_COSTS, INGREDIENT_NAMES, PRODUCT_NAMES, PRODUCT_PRICES } from "@/lib/business";
import { useStore } from "@/lib/data/store";
import type { UiProposal } from "@/lib/data/types";
import { isGuardFlag } from "@/lib/flags";
import { friendlyPickup, money, shortRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

// Flags worth a glance on the card; the full list lives in Details.
const FLAG_PRIORITY: string[] = [
  "injection_suspected",
  "off_policy",
  "abusive",
  "allergy_mentioned",
  "counteroffer",
  "capacity_shortfall",
  "ingredient_shortfall",
  "complaint",
  "new_customer",
  "large_order",
];

const KIND_LABEL: Record<string, { label: string; dot: string }> = {
  intake: { label: "Reply", dot: "bg-sky" },
  ops: { label: "Restock", dot: "bg-crema" },
  winback: { label: "Win-back", dot: "bg-basil" },
};

function replyTotal(payload: ReplyPayload): number {
  let cents = 0;
  for (const o of payload.orders) {
    const sub = o.items.reduce((n, i) => n + (PRODUCT_PRICES[i.productId] ?? 0) * i.qty, 0);
    cents += o.perk === "welcome_back_10" ? sub - Math.round(sub * 0.1) : sub;
  }
  return cents;
}

/** "Sat 9:00 AM · 24 butter croissants" per pickup. */
function pickupLines(payload: ReplyPayload): string[] {
  return payload.orders.map(
    (o) =>
      `${friendlyPickup(o.pickupAt)} · ${o.items
        .map((i) => `${i.qty} ${(PRODUCT_NAMES[i.productId] ?? i.productId).toLowerCase()}`)
        .join(", ")}`,
  );
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
  const { state } = useStore();
  const reply = proposal.kind === "reply" ? (proposal.payload as ReplyPayload) : null;
  const reorder = proposal.kind === "reorder" ? (proposal.payload as ReorderPayload) : null;
  const guardFlags = proposal.riskFlags.filter(isGuardFlag);
  const asked = proposal.triggerMessageId
    ? state.messages.find((m) => m.id === proposal.triggerMessageId)?.body
    : undefined;
  const keyFlags = FLAG_PRIORITY.filter((f) => proposal.riskFlags.includes(f as never) && !isGuardFlag(f)).slice(0, 2);
  const kind = KIND_LABEL[proposal.agent] ?? KIND_LABEL.intake;
  const who = proposal.customerName ?? "New customer";

  const summary = reply
    ? reply.orders.length > 0
      ? { lines: pickupLines(reply), total: replyTotal(reply) }
      : null
    : reorder
      ? {
          lines: [
            `${reorder.lines
              .map((l) => `${l.qty} ${INGREDIENT_NAMES[l.ingredientId]?.unit ?? ""} ${(INGREDIENT_NAMES[l.ingredientId]?.name ?? l.ingredientId).toLowerCase()}`)
              .join(", ")} · ${reorder.supplier}`,
          ],
          total: reorder.lines.reduce((n, l) => n + (INGREDIENT_COSTS[l.ingredientId] ?? 0) * l.qty, 0),
        }
      : null;

  return (
    <motion.article
      layout
      initial={reduce ? false : { y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1, rotate: focused ? 0 : rotation }}
      whileHover={reduce ? undefined : { rotate: 0, y: -2 }}
      transition={{ type: "spring", stiffness: 380, damping: 22, mass: 0.7 }}
      onClick={onFocus}
      onDoubleClick={onOpen}
      className={cn(
        "ticket-paper ticket-shadow relative w-full overflow-hidden rounded-[18px] text-ink",
        focused && "ring-2 ring-crema ring-offset-4 ring-offset-surface",
        proposal.status === "executing" && "ticket-executing",
        proposal.status === "failed" && "ring-2 ring-tomato",
      )}
    >
      {(proposal.status === "executed" || proposal.approvedVia === "imessage") && (
        <Stamp
          kind={proposal.approvedVia === "imessage" ? "text" : "sent"}
          viaText={proposal.approvedVia === "imessage"}
          delay={proposal.parentProposalId ? 0.35 : 0}
        />
      )}
      {proposal.status === "rejected" && <Stamp kind="rejected" delay={proposal.parentProposalId ? 0.35 : 0} />}

      <div className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2">
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold tracking-wider text-ticket uppercase">
              <span className={cn("size-1.5 rounded-full", guardFlags.length ? "bg-tomato" : kind.dot)} />
              {kind.label}
            </span>
            <span className="truncate text-[16px] font-bold">{who}</span>
          </span>
          <span className="shrink-0 text-[12px] text-ink/50">{shortRelativeTime(proposal.createdAt)}</span>
        </div>

        {asked && <p className="line-clamp-2 text-[14px] text-ink/60 italic">&ldquo;{asked}&rdquo;</p>}

        <p className="text-[18px] leading-snug font-bold tracking-[-0.01em]">{proposal.rationale}</p>

        {guardFlags.length > 0 && (
          <div className="flex gap-2 rounded-xl bg-ink px-3 py-2.5 text-[13px] leading-snug text-ticket">
            <Shield className="mt-0.5 size-4 shrink-0 text-tomato" />
            <p>{proposal.guardSummary ?? "Guard caught this. The reply declines; no order."}</p>
          </div>
        )}

        {summary && (
          <div className="flex items-end justify-between gap-3 rounded-xl bg-ink/[0.05] px-3.5 py-2.5">
            <ul className="min-w-0 space-y-0.5 text-[14px] text-ink/85">
              {summary.lines.map((l) => (
                <li key={l} className="truncate">
                  {l}
                </li>
              ))}
            </ul>
            <span className="shrink-0 text-[18px] font-extrabold tabular-nums">{money(summary.total)}</span>
          </div>
        )}

        {keyFlags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {keyFlags.map((f) => (
              <RiskChip key={f} flag={f} />
            ))}
          </div>
        )}

        {proposal.status === "executing" && <p className="text-[13px] font-semibold text-ink/60">Sending…</p>}

        {proposal.status === "failed" && (
          <div
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-tomato/40 bg-tomato/10 px-3 py-2"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="min-w-0 flex-1 text-[13px] font-semibold text-[#a3341a]">{proposal.error ?? "Couldn't send"}</p>
            {onRetry && (
              <button type="button" onClick={onRetry} className={TICKET_SECONDARY}>
                Retry
              </button>
            )}
          </div>
        )}

        {proposal.status === "pending" && (
          <div className="flex flex-wrap items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={onApproveBoth ?? onApprove} className={TICKET_APPROVE}>
              {onApproveBoth ? "Approve both" : "Approve"}
            </button>
            <button type="button" onClick={onOpen} className={TICKET_SECONDARY}>
              Details
            </button>
            <button type="button" onClick={onRejectBoth ?? onReject} className={TICKET_SKIP}>
              {onRejectBoth ? "Skip both" : "Skip"}
            </button>
          </div>
        )}
      </div>
    </motion.article>
  );
}

// Cream paper, so its buttons use ink and cherry rather than the dark-room defaults.
const TICKET_APPROVE =
  "rounded-full bg-cherry px-5 py-2 text-[13px] font-bold tracking-wide text-white uppercase hover:bg-cherry/90";
const TICKET_SECONDARY =
  "rounded-full border border-ink/20 px-4 py-2 text-[13px] font-bold tracking-wide text-ink uppercase hover:bg-ink/5";
const TICKET_SKIP = "rounded-full px-3 py-2 text-[13px] font-bold tracking-wide text-ink/50 uppercase hover:text-ink";
