"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PAYMENT_LINK_TOKEN, type ReplyPayload, type ReorderPayload } from "@boh/shared";
import { Phone, Shield } from "lucide-react";
import { toast } from "sonner";
import { callConversationIds } from "@/lib/data/derive";
import { useStore } from "@/lib/data/store";
import { flagMeta, isGuardFlag } from "@/lib/flags";
import { maskHandle, money, shortRelativeTime } from "@/lib/format";
import { pickupGroups, reorderLines, type MenuLine, type OrderGroup } from "@/lib/order-math";
import { cn } from "@/lib/utils";

const MAX_TEXT = 1200;
const AGENT_NAME: Record<string, string> = { intake: "Intake", ops: "Ops", guard: "Guard", winback: "Win-back" };

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="border-t border-line pt-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-bold text-ink">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** A menu line: label, dotted leader, price. The room's one signature move. */
function Leader({ line, strong, tone }: { line: MenuLine; strong?: boolean; tone?: "terrace" }) {
  return (
    <div className={cn("flex items-baseline text-[15px]", strong ? "font-bold text-ink" : "text-ink/85")}>
      <span className="min-w-0 truncate">{line.label}</span>
      <span className="leader" aria-hidden />
      <span className={cn("shrink-0 tabular", tone === "terrace" && "text-terrace")}>{money(line.cents)}</span>
    </div>
  );
}

/** Shows {{payment_link}} the way the customer will get it: as a link, filled in on approve. */
function ReplyText({ text }: { text: string }) {
  const parts = text.split(PAYMENT_LINK_TOKEN);
  return (
    <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-ink">
      {parts.map((chunk, i) => (
        <span key={i}>
          {chunk}
          {i < parts.length - 1 && (
            <span className="font-semibold text-brew underline decoration-brew/40 underline-offset-4" title="The Square payment link is created when you approve">
              payment link
            </span>
          )}
        </span>
      ))}
    </p>
  );
}

export function OrderDetail({ group, onOpenPerson }: { group: OrderGroup; onOpenPerson: (conversationId: string) => void }) {
  const { state, approve, reject, retry, sendMessage, getTrace } = useStore();
  const { lead, linked } = group;
  const reply = lead.kind === "reply" ? (lead.payload as ReplyPayload) : null;
  const restocks = [lead, ...linked].filter((p) => p.kind === "reorder");
  const pending = lead.status === "pending";
  const guardFlags = lead.riskFlags.filter(isGuardFlag);
  // One real risk at most in the header; the rest is already in the plan and the queue row.
  const risk = lead.riskFlags.find((f) => f === "allergy_mentioned" || f === "complaint");
  const conv = state.conversations.find((c) => c.id === lead.conversationId);
  // A phone order: the call summary and transcript are in People.
  const fromCall = Boolean(lead.conversationId && callConversationIds(state.events).has(lead.conversationId));
  const who = lead.kind === "reorder" && !lead.conversationId ? `Restock from ${(lead.payload as ReorderPayload).supplier}` : (lead.customerName ?? (conv ? maskHandle(conv.handle) : "New customer"));

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(reply?.text ?? "");
  const [composing, setComposing] = useState(false);
  const [own, setOwn] = useState("");
  const [busy, setBusy] = useState(false);
  const ownRef = useRef<HTMLTextAreaElement>(null);
  const edited = reply !== null && draft !== reply.text;

  const thread = useMemo(
    () =>
      state.messages
        .filter((m) => m.conversationId === lead.conversationId)
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
        .slice(-4),
    [state.messages, lead.conversationId],
  );
  const steps = getTrace(lead);

  const run = async (work: Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await work;
      toast.success(done);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn't go through");
    } finally {
      setBusy(false);
    }
  };

  const approveMain = () =>
    run(
      approve(lead.id, { includeLinked: linked.length > 0, editedText: edited ? draft : undefined }),
      linked.length > 0 ? "Reply sent and restock ordered" : lead.kind === "reorder" ? "Restock ordered" : "Reply sent",
    );
  const approveAlt = (i: number) =>
    run(approve(lead.id, { includeLinked: linked.length > 0, alternativeIndex: i }), "Sent that wording instead");
  const skip = () => run(reject(lead.id, { includeLinked: linked.length > 0 }), "Skipped");
  const sendOwn = () => {
    const text = own.trim();
    if (!text || !lead.conversationId) return;
    if (text.includes(PAYMENT_LINK_TOKEN)) {
      toast.error("Payment links only come from approving an order.");
      return;
    }
    // A fresh id per press: a double click still sends once (the server dedupes on it).
    void run(sendMessage(lead.conversationId, text, crypto.randomUUID()), "Your message was sent").then(() => {
      setOwn("");
      setComposing(false);
    });
  };

  // E edits the reply and W writes your own; A, R, J, and K live with the queue.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (!pending) return;
      if ((e.key === "e" || e.key === "E") && reply) {
        e.preventDefault();
        setEditing(true);
      }
      if ((e.key === "w" || e.key === "W") && lead.conversationId) {
        e.preventDefault();
        setComposing(true);
        setTimeout(() => ownRef.current?.focus(), 0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, reply, lead.conversationId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-paper">
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 pt-7 pb-8 lg:px-8">
        <header>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="heading text-[30px] text-ink">{who}</h2>
            {conv && (
              <button type="button" onClick={() => onOpenPerson(conv.id)} className="text-[14px] font-semibold text-brew underline-offset-4 hover:underline">
                See everything with {lead.customerName?.split(" ")[0] ?? "them"}
              </button>
            )}
          </div>
          <p className="mt-1 text-[14px] text-muted">
            {lead.kind === "reorder"
              ? "Supplier order drafted by the agents"
              : `${fromCall ? "Ordered on a phone call" : "Texted"} ${shortRelativeTime(lead.createdAt)}`}
            {!fromCall && conv?.platform === "imessage" ? " on iMessage" : ""}
            {risk && <span className="font-semibold text-qamar"> · {flagMeta(risk).label}</span>}
          </p>
        </header>

        {guardFlags.length > 0 && (
          <div className="flex gap-3 rounded-lg bg-qamar px-4 py-3 text-[15px] leading-snug text-paper">
            <Shield className="mt-0.5 size-5 shrink-0" />
            <p>
              <strong className="font-bold">Guard caught this.</strong>{" "}
              {lead.guardSummary ?? "The message tried to get around the shop's rules. The reply declines; no order is made."}
            </p>
          </div>
        )}

        {thread.length > 0 && (
          <div className="space-y-2">
            {thread.map((m) => (
              <div key={m.id} className={cn("flex", m.direction === "inbound" ? "justify-start" : "justify-end")}>
                <p
                  className={cn(
                    "max-w-[78%] rounded-2xl px-4 py-2 text-[14px] leading-snug whitespace-pre-wrap",
                    m.direction === "inbound" ? "rounded-bl-md bg-bubble-in text-ink" : "rounded-br-md bg-bubble-out text-ink",
                  )}
                >
                  {m.body}
                </p>
              </div>
            ))}
          </div>
        )}

        <p className="text-[19px] leading-snug font-semibold text-ink">{lead.rationale}</p>

        {reply && (
          <Section
            title="Our reply"
            aside={
              pending && (
                <button type="button" onClick={() => setEditing((v) => !v)} className="text-[14px] font-semibold text-brew hover:underline">
                  {editing ? "Done" : "Edit"}
                </button>
              )
            }
          >
            {editing ? (
              <div>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={5}
                  aria-label="Edit the reply"
                  className="w-full resize-y rounded-lg border border-line-strong bg-paper px-4 py-3 text-[15px] leading-relaxed text-ink focus:border-brew focus:outline-none"
                />
                <p className={cn("mt-1 text-right text-[12px] tabular", draft.length > MAX_TEXT ? "text-qamar" : "text-muted")}>
                  {draft.length}/{MAX_TEXT}
                </p>
              </div>
            ) : (
              <div className="border-y border-line py-4">
                <ReplyText text={draft} />
              </div>
            )}

            {pending && !editing && (reply.alternatives?.length ?? 0) > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-[14px] text-muted">Or send one of these instead:</p>
                <ul className="divide-y divide-line border-y border-line">
                  {reply.alternatives!.map((alt, i) => (
                    <li key={i} className="flex items-start gap-4 py-3">
                      <div className="min-w-0 flex-1 text-[14px] text-ink/90">
                        <ReplyText text={alt} />
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void approveAlt(i)}
                        className="shrink-0 rounded-full border border-line-strong px-3 py-1.5 text-[13px] font-semibold text-brew hover:bg-bg disabled:opacity-50"
                      >
                        Send this
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>
        )}

        {reply && reply.orders.length > 0 && (
          <Section title={reply.orders.length > 1 ? "The order, split across two pickups" : "The order"}>
            <div className="space-y-4">
              {pickupGroups(reply).map((g, i) => (
                <div key={i}>
                  <p className="mb-1 text-[13px] font-semibold text-muted">Pickup {g.when}</p>
                  {g.lines.map((l) => (
                    <Leader key={l.label} line={l} />
                  ))}
                  {g.discountCents > 0 && <Leader line={{ label: "Welcome back, 10% off", cents: -g.discountCents }} tone="terrace" />}
                </div>
              ))}
              <div className="border-t border-line pt-2">
                <Leader
                  strong
                  line={{
                    label: reply.orders.length > 1 ? "One payment link for both" : "Payment link",
                    cents: pickupGroups(reply).reduce((n, g) => n + g.lines.reduce((m, l) => m + l.cents, 0) - g.discountCents, 0),
                  }}
                />
              </div>
            </div>
          </Section>
        )}

        {restocks.length > 0 && (
          <Section title={lead.kind === "reorder" ? "Supplier order" : "Goes out with it: a restock"}>
            {restocks.map((r) => {
              const p = r.payload as ReorderPayload;
              const lines = reorderLines(p);
              return (
                <div key={r.id}>
                  {r !== lead && <p className="mb-2 text-[14px] text-ink/85">{r.rationale}</p>}
                  {lines.map((l) => (
                    <Leader key={l.label} line={l} />
                  ))}
                  <div className="mt-2 border-t border-line pt-2">
                    <Leader strong line={{ label: p.supplier, cents: lines.reduce((n, l) => n + l.cents, 0) }} />
                  </div>
                  <p className="mt-1 text-[12px] text-muted">The supplier is simulated in this demo.</p>
                </div>
              );
            })}
          </Section>
        )}

        <Section title="How the agents got here" aside={steps.length > 0 && <span className="text-[13px] text-muted">{steps.length} steps</span>}>
          {steps.length === 0 ? (
            <p className="text-[14px] text-muted">No steps were recorded for this one.</p>
          ) : (
            <ol className="space-y-3">
              {steps.map((s) => (
                <li key={s.id} className="grid grid-cols-[5.5rem_1fr] gap-3 text-[14px]">
                  <span className={cn("font-semibold", s.agent === "guard" ? "text-qamar" : "text-muted")}>{AGENT_NAME[s.agent] ?? s.agent}</span>
                  <span className="text-ink/90">{s.summary}</span>
                </li>
              ))}
            </ol>
          )}
          {lead.evidence.length > 0 && (
            <dl className="mt-5 space-y-1.5 border-t border-dashed border-line pt-4">
              {lead.evidence.map((ev) => (
                <div key={`${ev.label}-${ev.value}`} className="flex items-baseline text-[14px]">
                  <dt className="shrink-0 text-muted">{ev.label}</dt>
                  <span className="leader" aria-hidden />
                  <dd className="min-w-0 truncate text-right text-ink/90">{ev.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </Section>
      </div>

      {(pending || lead.status === "failed") && (
        <div className="sticky bottom-0 z-10 border-t border-line bg-paper px-5 py-4 lg:px-8">
          {composing && lead.conversationId ? (
            <div className="space-y-2">
              <textarea
                ref={ownRef}
                value={own}
                onChange={(e) => setOwn(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    sendOwn();
                  }
                  if (e.key === "Escape") setComposing(false);
                }}
                rows={3}
                placeholder={`Write to ${lead.customerName?.split(" ")[0] ?? "them"} in your own words`}
                aria-label="Your own message"
                className="w-full resize-none rounded-lg border border-line-strong bg-paper px-4 py-3 text-[15px] text-ink focus:border-brew focus:outline-none"
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={busy || !own.trim()}
                  onClick={sendOwn}
                  className="inline-flex h-11 items-center rounded-full bg-brew px-6 text-[15px] font-semibold text-paper hover:bg-brew/90 disabled:opacity-40"
                >
                  Send my message
                </button>
                <button type="button" onClick={() => setComposing(false)} className="text-[14px] font-semibold text-muted hover:text-ink">
                  Cancel
                </button>
                <span className="ml-auto text-[12px] text-muted">⌘↵ to send. The agents&apos; draft is dropped.</span>
              </div>
            </div>
          ) : lead.status === "failed" ? (
            <div className="flex flex-wrap items-center gap-4">
              <p className="min-w-0 flex-1 text-[14px] text-qamar">{lead.error ?? "This didn't send."}</p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(retry(lead.id), "Sent")}
                className="inline-flex h-11 items-center rounded-full bg-brew px-6 text-[15px] font-semibold text-paper hover:bg-brew/90 disabled:opacity-40"
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={busy || (editing && (draft.trim() === "" || draft.length > MAX_TEXT))}
                onClick={() => void approveMain()}
                title="Approve (A)"
                className="inline-flex h-11 items-center rounded-full bg-brew px-7 text-[15px] font-semibold text-paper transition-colors duration-150 hover:bg-[#4a2711] disabled:opacity-40"
              >
                {linked.length > 0 ? "Approve reply and restock" : lead.kind === "reorder" ? "Approve restock" : edited ? "Approve my edit" : "Approve"}
              </button>
              {lead.conversationId && (
                <button
                  type="button"
                  onClick={() => {
                    setComposing(true);
                    setTimeout(() => ownRef.current?.focus(), 0);
                  }}
                  title="Write your own (W)"
                  className="inline-flex h-11 items-center rounded-full border border-line-strong px-5 text-[15px] font-semibold text-ink hover:bg-bg"
                >
                  Write my own
                </button>
              )}
              <button type="button" disabled={busy} onClick={() => void skip()} title="Skip (R)" className="px-3 text-[15px] font-semibold text-muted hover:text-ink">
                Skip
              </button>
              {lead.approvedVia === "imessage" && (
                <span className="ml-auto inline-flex items-center gap-1.5 text-[13px] text-muted">
                  <Phone className="size-4" /> Approved by text
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {!pending && lead.status !== "failed" && (
        <div className="border-t border-line px-8 py-4 text-[14px] text-muted">
          {lead.status === "executed"
            ? lead.approvedVia === "imessage"
              ? "Approved by text from your phone, and sent."
              : "Approved and sent."
            : lead.status === "executing"
              ? "Sending…"
              : lead.status === "rejected"
                ? "Skipped. Nothing was sent."
                : "Replaced by a newer message."}
        </div>
      )}
    </div>
  );
}

