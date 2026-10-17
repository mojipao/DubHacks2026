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
import { friendlyPickup, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

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
                ? "bg-amber"
                : "bg-ink/70"
              : "bg-ink/15",
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
  linked,
  rotation,
  onFocus,
  onOpen,
  onApprove,
  onReject,
  onApproveBoth,
  onRejectBoth,
}: {
  proposal: UiProposal;
  focused: boolean;
  linked?: boolean;
  rotation: number;
  onFocus: () => void;
  onOpen: () => void;
  onApprove: () => void;
  onReject: () => void;
  onApproveBoth?: () => void;
  onRejectBoth?: () => void;
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
        "ticket-paper relative w-full overflow-hidden rounded-[6px] shadow-[0_10px_28px_rgba(0,0,0,0.35)]",
        focused && "ring-2 ring-amber",
        proposal.status === "executing" && "animate-pulse",
        proposal.status === "failed" && "ring-2 ring-tomato",
        linked && "ring-1 ring-ink/10",
      )}
    >
      <div className="ticket-perforation h-2 w-full bg-transparent" />
      <div
        className={cn(
          "flex items-center justify-between gap-2 px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-white uppercase",
          proposal.agent === "intake" && "bg-[#3d342e]",
          proposal.agent === "ops" && "bg-[#5a3d1a]",
          proposal.agent === "winback" && "bg-[#1f4a2e]",
        )}
      >
        <span>
          {proposal.agent} · {proposal.kind}
          {proposal.customerName ? ` · ${proposal.customerName}` : " · unknown"}
        </span>
        <div className="flex items-center gap-2 normal-case tracking-normal">
          <span className="font-mono text-[10px] text-white/70">
            {relativeTime(proposal.createdAt)}
          </span>
          <ConfidenceMeter value={proposal.confidence} />
        </div>
      </div>

      {(proposal.status === "executed" ||
        proposal.approvedVia === "imessage") && (
        <Stamp
          kind={proposal.approvedVia === "imessage" ? "text" : "sent"}
          viaText={proposal.approvedVia === "imessage"}
        />
      )}
      {proposal.status === "rejected" && <Stamp kind="rejected" />}

      <div className="space-y-2.5 px-3 py-3 text-ink">
        <div className="flex flex-wrap items-start gap-2">
          <p className="min-w-0 flex-1 text-[15px] font-bold leading-snug">
            {proposal.rationale}
          </p>
          {proposal.riskFlags.includes("counteroffer") && (
            <span className="shrink-0 rounded-[4px] bg-tomato px-1.5 py-0.5 text-[10px] font-black tracking-wider text-white uppercase">
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
          <div className="flex gap-2 rounded-[4px] bg-tomato px-2.5 py-2 text-[13px] leading-snug text-white">
            <Shield className="mt-0.5 size-4 shrink-0" />
            <p>
              {proposal.guardSummary ??
                "Guard flagged this draft. Reply declines; no order."}
            </p>
          </div>
        )}

        {reply && (
          <div className="space-y-2">
            <p className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-ink/90">
              {reply.text.split(PAYMENT_LINK_TOKEN).map((chunk, i, arr) => (
                <span key={i}>
                  {chunk}
                  {i < arr.length - 1 && (
                    <span className="mx-0.5 inline-flex rounded-full bg-sky/20 px-2 py-0.5 text-[11px] font-semibold text-[#1a4f7a]">
                      Square payment link (created on approve)
                    </span>
                  )}
                </span>
              ))}
            </p>
            {reply.orders.map((order, idx) => (
              <div
                key={idx}
                className="rounded-[4px] border border-dashed border-ink/15 bg-white/40 px-2 py-1.5 font-mono text-[12px]"
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
                  <div className="text-basil">Perk: welcome back 10%</div>
                )}
              </div>
            ))}
          </div>
        )}

        {reorder && (
          <div className="rounded-[4px] border border-dashed border-ink/15 bg-white/40 px-2 py-1.5 font-mono text-[12px]">
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

        {proposal.error && (
          <p className="text-[13px] font-semibold text-tomato">{proposal.error}</p>
        )}

        {proposal.status === "pending" && (
          <div
            className="flex flex-wrap gap-1.5 pt-1"
            onClick={(e) => e.stopPropagation()}
          >
            {onApproveBoth ? (
              <>
                <Button
                  size="sm"
                  className="bg-basil text-white hover:bg-basil/90"
                  onClick={onApproveBoth}
                >
                  Approve both
                </Button>
                <Button size="sm" variant="outline" onClick={onRejectBoth}>
                  Reject both
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  className="bg-basil text-white hover:bg-basil/90"
                  onClick={onApprove}
                >
                  Approve
                </Button>
                <Button size="sm" variant="outline" onClick={onOpen}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-tomato/40 text-tomato hover:bg-tomato/10"
                  onClick={onReject}
                >
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
