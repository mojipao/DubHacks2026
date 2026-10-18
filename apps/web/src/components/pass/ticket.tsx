"use client";

import type { ReplyPayload, ReorderPayload } from "@boh/shared";
import { motion, useReducedMotion } from "motion/react";
import { ChevronRight, Shield } from "lucide-react";
import { RiskChip } from "@/components/pass/risk-chip";
import { Stamp } from "@/components/pass/stamp";
import { INGREDIENT_COSTS, INGREDIENT_NAMES, PRODUCT_NAMES, PRODUCT_PRICES } from "@/lib/business";
import { useStore } from "@/lib/data/store";
import type { UiProposal } from "@/lib/data/types";
import { isGuardFlag } from "@/lib/flags";
import { friendlyPickup, money, shortRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

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
  onFocus,
  onOpen,
  onApprove,
  onReject,
  onRetry,
}: {
  proposal: UiProposal;
  focused: boolean;
  onFocus: () => void;
  onOpen: () => void;
  onApprove: () => void;
  onReject: () => void;
  onRetry?: () => void;
}) {
  const reduce = useReducedMotion();
  const { state, getTrace } = useStore();
  const reply = proposal.kind === "reply" ? (proposal.payload as ReplyPayload) : null;
  const reorder = proposal.kind === "reorder" ? (proposal.payload as ReorderPayload) : null;
  const guardFlags = proposal.riskFlags.filter(isGuardFlag);
  const asked = proposal.triggerMessageId
    ? state.messages.find((m) => m.id === proposal.triggerMessageId)?.body
    : undefined;
  const keyFlags = FLAG_PRIORITY.filter((f) => proposal.riskFlags.includes(f as never) && !isGuardFlag(f)).slice(0, 2);
  const kind = KIND_LABEL[proposal.agent] ?? KIND_LABEL.intake;
  const who = proposal.customerName ?? "New customer";
  const steps = getTrace(proposal);
  const stepMs = steps.reduce((n, s) => n + (s.ms || 0), 0);
  const readTables = [
    ...new Set(steps.flatMap((s) => (s.reads ?? []).map((r) => r.table)).filter(Boolean)),
  ].slice(0, 3);
  const traceTeaser =
    steps.length > 0
      ? `${steps.length} agent step${steps.length === 1 ? "" : "s"}${stepMs ? ` · ${(stepMs / 1000).toFixed(1)} s` : ""}${
          readTables.length ? ` · ${readTables.join(" · ")}` : ""
        }`
      : proposal.reads.length > 0
        ? `Read ${[...new Set(proposal.reads.map((r) => r.table))].slice(0, 3).join(" · ")}`
        : null;

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
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      onClick={onFocus}
      onDoubleClick={onOpen}
      className={cn(
        "ticket-strip relative w-full py-5 text-ink",
        focused && "bg-surface-2/60",
        proposal.status === "executing" && "ticket-executing",
        proposal.status === "failed" && "bg-tomato/5",
      )}
    >
      {(proposal.status === "executed" || proposal.approvedVia === "imessage") && (
        <Stamp
          kind={proposal.approvedVia === "imessage" ? "text" : "sent"}
          viaText={proposal.approvedVia === "imessage"}
          delay={0}
        />
      )}
      {proposal.status === "rejected" && <Stamp kind="rejected" delay={0} />}

      <div className="space-y-3 px-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="flex min-w-0 items-baseline gap-2.5">
            <span className="shrink-0 font-mono text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">
              <span className={cn("mr-1.5 inline-block size-1.5 rounded-full align-middle", guardFlags.length ? "bg-tomato" : kind.dot)} />
              {kind.label}
            </span>
            <span className="truncate font-[family-name:var(--font-heading)] text-[22px] font-semibold tracking-[-0.02em]">
              {who}
            </span>
          </span>
          <span className="shrink-0 text-[13px] text-muted">{shortRelativeTime(proposal.createdAt)}</span>
        </div>

        {asked && (
          <p className="line-clamp-2 font-[family-name:var(--font-heading)] text-[16px] leading-snug text-muted italic">
            &ldquo;{asked}&rdquo;
          </p>
        )}

        <p className="text-[17px] leading-snug font-semibold tracking-[-0.01em]">{proposal.rationale}</p>

        {guardFlags.length > 0 && (
          <div className="flex gap-2.5 border-y border-line py-3 text-[14px] leading-snug">
            <Shield className="mt-0.5 size-4 shrink-0 text-tomato" />
            <p>{proposal.guardSummary ?? "Guard caught this. The reply declines; no order."}</p>
          </div>
        )}

        {summary && (
          <div className="flex items-end justify-between gap-4">
            <ul className="min-w-0 space-y-1 text-[15px] text-fg/80">
              {summary.lines.map((l) => (
                <li key={l} className="truncate">
                  {l}
                </li>
              ))}
            </ul>
            <span className="shrink-0 font-[family-name:var(--font-heading)] text-[22px] font-semibold tabular-nums">
              {money(summary.total)}
            </span>
          </div>
        )}

        {keyFlags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {keyFlags.map((f) => (
              <RiskChip key={f} flag={f} />
            ))}
          </div>
        )}

        {traceTeaser && proposal.status === "pending" && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            className="flex w-full items-center justify-between gap-2 text-left text-muted transition-colors hover:text-fg"
          >
            <span className="min-w-0 text-[13px]">
              <span className="opacity-60">How they got here · </span>
              {traceTeaser}
            </span>
            <ChevronRight className="size-4 shrink-0 opacity-40" />
          </button>
        )}

        {proposal.status === "executing" && <p className="text-[13px] font-semibold text-muted">Sending…</p>}

        {proposal.status === "failed" && (
          <div
            className="flex flex-wrap items-center justify-between gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="min-w-0 flex-1 text-[13px] font-semibold text-tomato">{proposal.error ?? "Couldn't send"}</p>
            {onRetry && (
              <button type="button" onClick={onRetry} className={TICKET_SECONDARY}>
                Retry
              </button>
            )}
          </div>
        )}

        {proposal.status === "pending" && (
          <div className="flex flex-wrap items-center gap-3 pt-1" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={onApprove} className={TICKET_APPROVE}>
              Approve
            </button>
            <button type="button" onClick={onOpen} className={TICKET_SECONDARY}>
              Details
            </button>
            <button type="button" onClick={onReject} className={TICKET_SKIP}>
              Skip
            </button>
          </div>
        )}
      </div>
    </motion.article>
  );
}

const TICKET_APPROVE =
  "rounded-full bg-cherry px-6 py-2.5 text-[13px] font-semibold tracking-[0.06em] text-white uppercase hover:bg-cherry/90";
const TICKET_SECONDARY =
  "rounded-full px-4 py-2.5 text-[13px] font-semibold tracking-[0.04em] text-fg/70 uppercase underline-offset-4 hover:underline";
const TICKET_SKIP = "rounded-full px-2 py-2.5 text-[13px] font-semibold tracking-[0.04em] text-muted uppercase hover:text-fg";
