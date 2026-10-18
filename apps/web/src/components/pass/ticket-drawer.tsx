"use client";

import { useState, type ReactNode } from "react";
import { PAYMENT_LINK_TOKEN, type ReplyPayload, type ReorderPayload } from "@boh/shared";
import { Phone, Shield } from "lucide-react";
import { AGENT_DOT, TraceTimeline } from "@/components/pass/trace";
import { RiskChip } from "@/components/pass/risk-chip";
import { GlowButton } from "@/components/glow-button";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { INGREDIENT_COSTS, INGREDIENT_NAMES, PRODUCT_NAMES, PRODUCT_PRICES } from "@/lib/business";
import { useStore } from "@/lib/data/store";
import type { UiProposal } from "@/lib/data/types";
import { isGuardFlag } from "@/lib/flags";
import { friendlyPickup, money, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const MAX_TEXT = 1200;

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber/15 text-amber",
  executing: "bg-amber/15 text-amber",
  executed: "bg-basil/15 text-basil",
  rejected: "bg-tomato/15 text-tomato",
  superseded: "bg-line text-muted",
  failed: "bg-tomato/20 text-tomato",
};

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-mono text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Catalog-priced breakdown. The server sets the real prices on approve; this shows the owner what that will be. */
function OrderBreakdown({ payload }: { payload: ReplyPayload }) {
  const groups = payload.orders.map((order) => {
    const lines = order.items.map((it) => ({ ...it, cents: (PRODUCT_PRICES[it.productId] ?? 0) * it.qty }));
    const sub = lines.reduce((n, l) => n + l.cents, 0);
    return { order, lines, sub, off: order.perk === "welcome_back_10" ? Math.round(sub * 0.1) : 0 };
  });
  const due = groups.reduce((n, g) => n + g.sub - g.off, 0);
  return (
    <div className="space-y-2">
      {groups.map(({ order, lines, off }, i) => (
        <div key={i} className="rounded-md border border-line bg-bg/60 px-3 py-2 font-mono text-[12px]">
          <div className="mb-1 font-semibold text-fg">{friendlyPickup(order.pickupAt)}</div>
          {lines.map((l) => (
            <div key={l.productId} className="flex justify-between text-fg/85">
              <span>
                {l.qty}× {PRODUCT_NAMES[l.productId] ?? l.productId}
              </span>
              <span className="tabular-nums">{money(l.cents)}</span>
            </div>
          ))}
          {off > 0 && (
            <div className="flex justify-between text-basil">
              <span>Welcome back 10%</span>
              <span className="tabular-nums">−{money(off)}</span>
            </div>
          )}
        </div>
      ))}
      <div className="flex justify-between px-1 font-mono text-[13px] text-fg">
        <span>{payload.orders.length > 1 ? "One Square link for both pickups" : "Square payment link"}</span>
        <span className="font-semibold tabular-nums">{money(due)}</span>
      </div>
    </div>
  );
}

function ReorderDetails({ payload }: { payload: ReorderPayload }) {
  const total = payload.lines.reduce((n, l) => n + (INGREDIENT_COSTS[l.ingredientId] ?? 0) * l.qty, 0);
  return (
    <div className="rounded-md border border-line bg-bg/60 px-3 py-2 font-mono text-[12px] text-fg/85">
      <div className="mb-1 font-semibold text-fg">{payload.supplier}</div>
      {payload.lines.map((l) => (
        <div key={l.ingredientId} className="flex justify-between">
          <span>
            {l.qty} {INGREDIENT_NAMES[l.ingredientId]?.unit ?? ""} {INGREDIENT_NAMES[l.ingredientId]?.name ?? l.ingredientId}
          </span>
          <span className="tabular-nums">{money((INGREDIENT_COSTS[l.ingredientId] ?? 0) * l.qty)}</span>
        </div>
      ))}
      {payload.neededBy && <div className="text-muted">needed by {friendlyPickup(payload.neededBy)}</div>}
      <div className="mt-1 flex justify-between border-t border-line pt-1 text-fg">
        <span>Simulated supplier order</span>
        <span className="font-semibold tabular-nums">{money(total)}</span>
      </div>
    </div>
  );
}

export function TicketDrawer({
  proposal,
  open,
  startEditing = false,
  onOpenChange,
}: {
  proposal: UiProposal | null;
  open: boolean;
  /** Opened with E: go straight to the editor. */
  startEditing?: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, approve, reject, retry, getTrace } = useStore();
  const [editing, setEditing] = useState(startEditing);
  const [draftById, setDraftById] = useState<Record<string, string>>({});

  if (!proposal) return null;

  const reply = proposal.kind === "reply" ? (proposal.payload as ReplyPayload) : null;
  const reorder = proposal.kind === "reorder" ? (proposal.payload as ReorderPayload) : null;
  const text = draftById[proposal.id] ?? reply?.text ?? "";
  const edited = reply !== null && text !== reply.text;
  const trace = getTrace(proposal);
  const pending = proposal.status === "pending";
  const children = state.proposals.filter((p) => p.parentProposalId === proposal.id && p.status === "pending");
  const canEdit = pending && reply !== null;
  const tooLong = text.length > MAX_TEXT;
  const empty = text.trim().length === 0;
  const linkRemoved = reply !== null && reply.orders.length > 0 && !text.includes(PAYMENT_LINK_TOKEN);
  const guardFlags = proposal.riskFlags.filter(isGuardFlag);

  const close = () => {
    setEditing(false);
    onOpenChange(false);
  };

  const run = (p: Promise<unknown>, ok: string) =>
    void p
      .then(() => {
        toast.success(ok);
        close();
      })
      .catch((err: Error) => toast.error(err.message));

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) setEditing(false);
        onOpenChange(o);
      }}
    >
      <SheetContent side="right" className="flex w-full flex-col gap-0 border-line bg-surface p-0 text-fg sm:max-w-xl">
        <SheetHeader className="border-b border-line px-6 pt-5 pb-4">
          <div className="mb-1 flex flex-wrap items-center gap-2 font-mono text-[11px] tracking-[0.14em] uppercase">
            <span className={cn("size-2 rounded-full", AGENT_DOT[proposal.agent] ?? "bg-muted")} />
            <span className="text-fg/80">
              {proposal.agent} · {proposal.kind}
            </span>
            <span className={cn("rounded px-1.5 py-0.5 tracking-wider", STATUS_STYLE[proposal.status])}>
              {proposal.status}
            </span>
            {proposal.approvedVia === "imessage" && (
              <span className="inline-flex items-center gap-1 rounded bg-sky/15 px-1.5 py-0.5 text-sky">
                <Phone className="size-3" /> approved by text
              </span>
            )}
            {proposal.shortCode && <span className="text-muted">code {proposal.shortCode}</span>}
          </div>
          <SheetTitle className="text-[18px] text-fg">
            {proposal.customerName ?? "Unknown customer"} · {proposal.title}
          </SheetTitle>
          <SheetDescription className="text-muted">
            {proposal.summary} · drafted {relativeTime(proposal.createdAt)}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <div>
            <p className="text-[17px] leading-snug font-semibold text-fg">{proposal.rationale}</p>
            {proposal.riskFlags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {proposal.riskFlags.map((f) => (
                  <RiskChip key={f} flag={f} />
                ))}
              </div>
            )}
            {guardFlags.length > 0 && (
              <div className="mt-2 flex gap-2 rounded-md bg-tomato px-3 py-2 text-[13px] leading-snug text-white">
                <Shield className="mt-0.5 size-4 shrink-0" />
                <p>{proposal.guardSummary ?? "Guard flagged this draft. Reply declines; no order."}</p>
              </div>
            )}
            {proposal.status === "failed" && proposal.error && (
              <p className="mt-2 rounded-md border border-tomato/40 bg-tomato/10 px-3 py-2 text-[13px] text-tomato">
                {proposal.error}
              </p>
            )}
          </div>

          <Section title="How the agents got here">
            <TraceTimeline steps={trace} />
          </Section>

          {reply && (
            <Section
              title={edited ? "Draft · edited" : "Draft"}
              aside={
                canEdit && (
                  <Button size="sm" variant="ghost" className="h-7 text-amber hover:text-amber" onClick={() => setEditing((v) => !v)}>
                    {editing ? "Preview" : "Edit"}
                  </Button>
                )
              }
            >
              {editing ? (
                <div>
                  <Textarea
                    autoFocus
                    value={text}
                    onChange={(e) => setDraftById((prev) => ({ ...prev, [proposal.id]: e.target.value }))}
                    className="min-h-44 border-line bg-bg font-mono text-[13px] leading-relaxed"
                    aria-label="Edit reply"
                  />
                  <div className="mt-1 flex justify-between gap-2 text-[12px] text-muted">
                    <span>
                      {linkRemoved && (
                        <span className="text-tomato">
                          {PAYMENT_LINK_TOKEN} removed: the link will be added on its own line.
                        </span>
                      )}
                    </span>
                    <span className={cn("tabular-nums", tooLong && "text-tomato")}>
                      {text.length}/{MAX_TEXT}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="rounded-md bg-bg/60 px-3 py-2.5 font-mono text-[13px] leading-relaxed whitespace-pre-wrap text-fg/90">
                  {text.split(PAYMENT_LINK_TOKEN).map((chunk, i, arr) => (
                    <span key={i}>
                      {chunk}
                      {i < arr.length - 1 && (
                        <span className="mx-0.5 rounded-full bg-sky/20 px-2 py-0.5 text-[11px] font-semibold text-sky">
                          Square payment link
                        </span>
                      )}
                    </span>
                  ))}
                </p>
              )}
            </Section>
          )}

          {reply && reply.orders.length > 0 && (
            <Section title="Orders on approve">
              <OrderBreakdown payload={reply} />
            </Section>
          )}

          {reorder && (
            <Section title="Supplier order">
              <ReorderDetails payload={reorder} />
            </Section>
          )}

          {proposal.evidence.length > 0 && (
            <Section title="Evidence">
              <ul className="space-y-1.5">
                {proposal.evidence.map((e) => (
                  <li key={`${e.label}-${e.value}`} className="flex items-baseline justify-between gap-3 rounded-md border border-line bg-bg/50 px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-fg">{e.label}</div>
                      <div className="text-[13px] text-fg/75">{e.value}</div>
                    </div>
                    {e.source && (
                      <span className="shrink-0 font-mono text-[10px] text-muted" title={`${e.source.table}/${e.source.id}`}>
                        {e.source.table}/{e.source.id.slice(0, 8)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        {(pending || proposal.status === "failed") && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-4 border-t border-line bg-surface px-6 py-4">
            {pending && (
              <>
                <GlowButton
                  tone="basil"
                  disabled={canEdit && editing && (empty || tooLong)}
                  onClick={() =>
                    run(
                      approve(proposal.id, {
                        editedText: edited ? text : undefined,
                        includeLinked: children.length > 0,
                      }),
                      children.length > 0 ? "Approved both" : "Approved",
                    )
                  }
                >
                  {children.length > 0 ? "Approve both" : edited ? "Approve edited" : "Approve"}
                </GlowButton>
                <GlowButton
                  tone="tomato"
                  onClick={() =>
                    run(
                      reject(proposal.id, { includeLinked: children.length > 0 }),
                      children.length > 0 ? "Skipped both" : "Skipped",
                    )
                  }
                >
                  {children.length > 0 ? "Skip both" : "Skip"}
                </GlowButton>
                {children.length > 0 && (
                  <span className="text-[12px] text-muted">Includes the linked reorder.</span>
                )}
              </>
            )}
            {proposal.status === "failed" && (
              <GlowButton tone="cherry" onClick={() => run(retry(proposal.id), "Retried")}>
                Retry
              </GlowButton>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
