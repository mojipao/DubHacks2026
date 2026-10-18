import type { UiEvent, UiMessage, UiProposal } from "@/lib/data/types";

/** Everything here is read from the events the store already loads; no extra queries. */

export type UiCall = {
  callId: string;
  conversationId: string;
  startedAt: string;
  durationSecs: number;
  turns: number;
  summary: string | null;
  caller: string;
};

export function callsByConversation(events: UiEvent[]): Map<string, UiCall[]> {
  const out = new Map<string, UiCall[]>();
  for (const e of events) {
    if (e.type !== "call.transcribed" || !e.subjectId) continue;
    const d = e.data as { callId?: string; startedAt?: string; durationSecs?: number; turns?: number; summary?: string | null; caller?: string };
    const list = out.get(e.subjectId) ?? [];
    list.push({
      callId: String(d.callId ?? e.id),
      conversationId: e.subjectId,
      startedAt: d.startedAt ?? e.at,
      durationSecs: Number(d.durationSecs ?? 0),
      turns: Number(d.turns ?? 0),
      summary: d.summary ?? null,
      caller: d.caller ?? "",
    });
    out.set(e.subjectId, list.sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt)));
  }
  return out;
}

/** Conversations a phone call belongs to: imported calls, and calls that placed an order. */
export function callConversationIds(events: UiEvent[]): Set<string> {
  return new Set(
    events.filter((e) => (e.type === "call.transcribed" || e.type === "call.linked") && e.subjectId).map((e) => e.subjectId!),
  );
}

/** Every transcribed call, newest first. */
export function allCalls(events: UiEvent[]): UiCall[] {
  return [...callsByConversation(events).values()]
    .flat()
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}

export function reviewedCallIds(events: UiEvent[]): Set<string> {
  return new Set(
    events.filter((e) => e.type === "call.reviewed").map((e) => String((e.data as { callId?: unknown }).callId ?? "")).filter(Boolean),
  );
}

/** Turns that fall inside a call's clock, so the Calls tab can show a transcript without a second query. */
export function messagesForCall(messages: UiMessage[], call: UiCall): UiMessage[] {
  const start = Date.parse(call.startedAt) - 8_000;
  const end = Date.parse(call.startedAt) + (call.durationSecs + 90) * 1000;
  return messages
    .filter((m) => m.conversationId === call.conversationId && Date.parse(m.createdAt) >= start && Date.parse(m.createdAt) <= end)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

/** Tickets drafted from a call: prefer the trigger message inside the call clock, else the ticket's own time. */
export function ticketsForCall(proposals: UiProposal[], call: UiCall, messages: UiMessage[] = []): UiProposal[] {
  const start = Date.parse(call.startedAt) - 60_000;
  const end = Date.parse(call.startedAt) + (call.durationSecs + 180) * 1000;
  const byId = new Map(messages.map((m) => [m.id, m]));
  return proposals
    .filter((p) => {
      if (p.conversationId !== call.conversationId) return false;
      const trigger = p.triggerMessageId ? byId.get(p.triggerMessageId) : undefined;
      const at = Date.parse(trigger?.createdAt ?? p.createdAt);
      return at >= start && at <= end;
    })
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export type UiCallback = {
  eventId: string;
  conversationId: string | null;
  name: string;
  purpose: string;
  at: string;
};

/** Tap-to-call-backs we sent that the customer has not called in on yet. */
export function openCallbacks(events: UiEvent[], now = Date.now()): UiCallback[] {
  const used = new Set(
    events.filter((e) => e.type === "call.callback_consumed").map((e) => String((e.data as { requestedEventId?: unknown }).requestedEventId ?? "")),
  );
  const day = 24 * 60 * 60 * 1000;
  return events
    .filter((e) => e.type === "call.callback_requested" && !used.has(e.id) && now - Date.parse(e.at) < day)
    .map((e) => {
      const d = e.data as { name?: string; purpose?: string; conversationId?: string | null };
      return {
        eventId: e.id,
        conversationId: e.subjectId ?? d.conversationId ?? null,
        name: d.name ?? "Customer",
        purpose: d.purpose ?? "a follow-up",
        at: e.at,
      };
    })
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

export type UiHold = {
  eventId: string;
  conversationId: string;
  title: string;
  summary: string;
  at: string;
  expiresAt: string;
};

/** Orders the agent checked with the customer and is waiting on a YES or NO for. */
export function openHolds(events: UiEvent[], now = Date.now()): UiHold[] {
  const closed = new Set(
    events.filter((e) => e.type === "order.hold_closed").map((e) => String((e.data as { heldEventId?: unknown }).heldEventId)),
  );
  return events
    .filter((e) => e.type === "order.held" && e.subjectId && !closed.has(String(e.id)))
    .map((e) => {
      const d = e.data as { title?: string; summary?: string; expiresAt?: string };
      return {
        eventId: String(e.id),
        conversationId: e.subjectId!,
        title: d.title ?? "Order",
        summary: d.summary ?? "",
        at: e.at,
        expiresAt: d.expiresAt ?? e.at,
      };
    })
    .filter((h) => Date.parse(h.expiresAt) > now)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

export type Sender = "agent" | "agent-checkin" | "owner" | "owner-approved";

/** Who put each outbound message out: the agent on its own, its order check-in, the owner typing, or an owner approval. */
export function senders(events: UiEvent[]): Map<string, Sender> {
  const agentProposals = new Set(
    events.filter((e) => e.type === "proposal.approved" && e.data.via === "agent").map((e) => e.subjectId),
  );
  const out = new Map<string, Sender>();
  for (const e of events) {
    if (e.type === "order.held") {
      const id = (e.data as { checkInMessageId?: string }).checkInMessageId;
      if (id) out.set(id, "agent-checkin");
    }
    if (e.type === "owner.message" && e.subjectId) out.set(e.subjectId, "owner");
  }
  for (const e of events) {
    if (e.type !== "message.sent" || !e.subjectId || out.has(e.subjectId)) continue;
    const pid = String(e.data.proposalId ?? "");
    const key = String(e.data.key ?? "");
    if (agentProposals.has(pid)) out.set(e.subjectId, "agent");
    else if (key.startsWith("hold:")) out.set(e.subjectId, "agent-checkin");
    else if (key.startsWith("hold-")) out.set(e.subjectId, "agent");
    else if (key.startsWith("campaign:") || key.startsWith("owner-message:")) out.set(e.subjectId, "owner");
    else if (key.startsWith("owner-reply:") || key.startsWith("notify:")) out.set(e.subjectId, "agent");
    else out.set(e.subjectId, "owner-approved");
  }
  return out;
}

/** Proposal ids the agent sent on its own. */
export function agentSentProposalIds(events: UiEvent[]): Set<string> {
  return new Set(events.filter((e) => e.type === "proposal.approved" && e.data.via === "agent" && e.subjectId).map((e) => e.subjectId!));
}

export function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return m ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
}
