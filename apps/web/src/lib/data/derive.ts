import type { UiEvent } from "@/lib/data/types";

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
