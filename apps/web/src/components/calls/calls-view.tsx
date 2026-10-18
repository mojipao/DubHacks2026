"use client";

import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { OrderDetail } from "@/components/orders/order-detail";
import { reviewCall, syncCalls } from "@/lib/actions";
import {
  allCalls,
  formatDuration,
  messagesForCall,
  openCallbacks,
  reviewedCallIds,
  ticketsForCall,
  type UiCall,
} from "@/lib/data/derive";
import { useStore } from "@/lib/data/store";
import { maskHandle, personLabel, shortRelativeTime } from "@/lib/format";
import { groupTickets } from "@/lib/order-math";
import { cn } from "@/lib/utils";

/**
 * Phone calls as their own board: transcript on the paper, the same Approve / Skip as Orders.
 * People still shows the mixed thread; this is where a call is a decision.
 */
export function CallsView({
  onOpenPerson,
}: {
  onOpenPerson: (conversationId: string) => void;
  onOpenOrder?: (conversationId: string) => void;
}) {
  const { state, mode } = useStore();
  const calls = useMemo(() => allCalls(state.events), [state.events]);
  const callbacks = useMemo(() => openCallbacks(state.events, Date.parse(state.now)), [state.events, state.now]);
  const reviewed = useMemo(() => reviewedCallIds(state.events), [state.events]);
  const [localReviewed, setLocalReviewed] = useState<Set<string>>(new Set());
  const seen = useMemo(() => new Set([...reviewed, ...localReviewed]), [reviewed, localReviewed]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = calls.find((c) => c.callId === selectedId) ?? calls[0] ?? null;

  const mark = async (call: UiCall, action: "reviewed" | "skipped") => {
    setLocalReviewed((s) => new Set([...s, call.callId]));
    if (mode === "mock") {
      toast.message(action === "skipped" ? "Skipped" : "Marked reviewed");
      return;
    }
    try {
      await reviewCall(call.callId, action);
      toast.message(action === "skipped" ? "Skipped" : "Marked reviewed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update the call");
    }
  };

  return (
    <div id="view-calls" role="tabpanel" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
      <section className="flex max-h-[45dvh] shrink-0 flex-col lg:max-h-none lg:w-[36%] lg:max-w-[480px] lg:min-w-[340px]">
        <div className="px-6 pt-7 pb-4">
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="heading text-[34px] text-ink">Calls</h1>
            <button
              type="button"
              onClick={() =>
                mode === "mock"
                  ? toast.message("Needs live mode")
                  : void syncCalls()
                      .then((r) => toast.success(r.imported ? `${r.imported} new call${r.imported > 1 ? "s" : ""}` : "No new calls"))
                      .catch((e: Error) => toast.error(e.message))
              }
              className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-brew hover:underline"
            >
              <RefreshCw className="size-4" aria-hidden />
              Check
            </button>
          </div>
          <p className="mt-1 text-[15px] text-muted">Transcripts, and the same approve or skip as a text order.</p>
        </div>
        {callbacks.length > 0 && (
          <div className="border-y border-line bg-[color-mix(in_srgb,var(--qishr)_14%,var(--paper))] px-6 py-3">
            <p className="text-[13px] font-semibold text-qishr-ink">Waiting on a callback</p>
            <ul className="mt-1 space-y-1">
              {callbacks.map((cb) => (
                <li key={cb.eventId} className="text-[15px] text-ink">
                  <span className="font-semibold">{cb.name}</span>
                  <span className="text-muted"> · {cb.purpose}</span>
                  <span className="ml-2 text-[13px] text-muted">{shortRelativeTime(cb.at)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <ul className="min-h-0 flex-1 overflow-y-auto border-t border-line">
          {calls.length === 0 && (
            <li className="px-6 py-10 text-[15px] text-muted">No transcribed calls yet. Inbound calls and tap-to-call-backs land here after they hang up.</li>
          )}
          {calls.map((call) => {
            const conv = state.conversations.find((c) => c.id === call.conversationId);
            const name = personLabel(conv?.customerName, conv ? "New customer" : call.caller || "Caller");
            const tickets = ticketsForCall(state.proposals, call, state.messages).filter((p) => p.status === "pending");
            const active = selected?.callId === call.callId;
            const unread = !seen.has(call.callId);
            return (
              <li key={call.callId} className="border-b border-line">
                <button
                  type="button"
                  onClick={() => setSelectedId(call.callId)}
                  aria-current={active || undefined}
                  className={cn("block w-full px-6 py-4 text-left transition-colors duration-150", active ? "bg-paper" : "hover:bg-paper/60")}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[16px] font-bold text-ink">{name}</span>
                    <span className="shrink-0 text-[13px] text-muted tabular">
                      {unread ? <span className="font-semibold text-qishr-ink">New</span> : shortRelativeTime(call.startedAt)}
                    </span>
                  </span>
                  <span className="mt-1 block truncate text-[14px] text-muted">
                    {call.summary || `${formatDuration(call.durationSecs)} · ${call.turns} turns`}
                  </span>
                  {tickets.length > 0 && <span className="mt-1 block text-[13px] font-semibold text-qishr-ink">Order waiting</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="flex min-h-0 min-w-0 flex-1 flex-col border-t border-line lg:border-t-0 lg:border-l">
        {selected ? (
          <CallDetail
            call={selected}
            seen={seen.has(selected.callId)}
            onOpenPerson={onOpenPerson}
            onSkipCall={() => void mark(selected, "skipped")}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center bg-paper text-[15px] text-muted">No call selected</div>
        )}
      </section>
    </div>
  );
}

function CallDetail({
  call,
  seen,
  onOpenPerson,
  onSkipCall,
}: {
  call: UiCall;
  seen: boolean;
  onOpenPerson: (conversationId: string) => void;
  onSkipCall: () => void;
}) {
  const { state } = useStore();
  const conv = state.conversations.find((c) => c.id === call.conversationId);
  const name = personLabel(conv?.customerName, conv ? "New customer" : call.caller || "Caller");
  const turns = useMemo(() => messagesForCall(state.messages, call), [state.messages, call]);
  const tickets = useMemo(() => ticketsForCall(state.proposals, call, state.messages), [state.proposals, state.messages, call]);
  const groups = useMemo(() => groupTickets(tickets, (p) => p.status === "pending" || p.status === "executing" || p.status === "failed"), [tickets]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-paper">
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line px-8 pt-6 pb-4">
        <div className="min-w-0">
          <h2 className="heading truncate text-[30px] text-ink">{name}</h2>
          <p className="mt-1 text-[14px] text-muted">
            {conv ? maskHandle(conv.handle) : call.caller} · {formatDuration(call.durationSecs)} · {call.turns} turns ·{" "}
            {shortRelativeTime(call.startedAt)}
          </p>
        </div>
        {conv && (
          <button type="button" onClick={() => onOpenPerson(conv.id)} className="text-[14px] font-semibold text-brew underline-offset-4 hover:underline">
            See everything with {name.split(" ")[0]}
          </button>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-6 px-8 py-6">
          {call.summary && <p className="max-w-prose text-[16px] leading-snug text-ink">{call.summary}</p>}
          <div>
            <h3 className="mb-3 text-[15px] font-bold text-ink">Transcript</h3>
            <div className="space-y-2.5">
              {turns.length === 0 && (
                <p className="text-[15px] text-muted">Transcript turns haven&apos;t loaded yet. Check for new calls, or open them in People.</p>
              )}
              {turns.map((m) => (
                <div key={m.id} className={cn("flex flex-col", m.direction === "inbound" ? "items-start" : "items-end")}>
                  <p
                    className={cn(
                      "max-w-[min(80%,36rem)] rounded-2xl px-4 py-2.5 text-[15px] leading-snug whitespace-pre-wrap",
                      m.direction === "inbound" ? "rounded-bl-md bg-bubble-in text-ink" : "rounded-br-md bg-bubble-out text-ink",
                    )}
                  >
                    {m.body}
                  </p>
                  <span className="mt-1 px-1 text-[12px] text-muted">
                    {m.direction === "inbound" ? "caller" : "agent"} · {shortRelativeTime(m.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {groups.length > 0 ? (
            <div className="-mx-8 border-t border-line">
              {groups.map((g) => (
                <OrderDetail key={g.lead.id} group={g} onOpenPerson={onOpenPerson} />
              ))}
            </div>
          ) : (
            <div className="border-t border-line pt-5">
              <p className="text-[15px] leading-relaxed text-muted">
                This call didn&apos;t put an order on Orders. Skip it once you&apos;ve read the transcript.
              </p>
              {!seen && (
                <button type="button" onClick={onSkipCall} className="mt-3 px-1 text-[15px] font-semibold text-muted hover:text-ink">
                  Skip
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
