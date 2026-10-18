"use client";

/** A failed call to one of our /api routes, with the server's status so callers can treat 409 differently. */
export class ActionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    throw new ActionError("Network error: the control room can't reach its API", 0);
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new ActionError(data.error ?? `Request failed (${res.status})`, res.status);
  }
  return data;
}

export function approveProposal(
  id: string,
  body?: { editedText?: string; alternativeIndex?: number; includeLinked?: boolean },
) {
  return post<{ proposals?: unknown[] }>(`/api/proposals/${id}/approve`, body);
}

export function rejectProposal(
  id: string,
  body?: { reason?: string; includeLinked?: boolean },
) {
  return post<{ proposals?: unknown[] }>(`/api/proposals/${id}/reject`, body);
}

export function retryProposal(id: string) {
  return post<{ proposals?: unknown[] }>(`/api/proposals/${id}/retry`);
}

export function simulateInbound(body: { handle: string; name?: string; text: string }) {
  return post<{ conversationId: string; messageId: string }>("/api/dev/inbound", body);
}

export function markPaid(orderId: string) {
  return post<unknown>(`/api/dev/mark-paid/${orderId}`);
}

export function customerPays(orderId: string) {
  return post<{ paymentId: string; status: string; amountCents: number }>(`/api/dev/square-pay/${orderId}`);
}

async function get<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { cache: "no-store" });
  } catch {
    throw new ActionError("Network error: the control room can't reach its API", 0);
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ActionError(data.error ?? `Request failed (${res.status})`, res.status);
  return data;
}

export function fetchContacts<T>() {
  return get<{ contacts: T[] }>("/api/contacts");
}

export function fetchOps<T>() {
  return get<T>("/api/ops");
}

export function fetchHistory<T>(conversationId: string, before?: string) {
  const q = new URLSearchParams({ limit: "100" });
  if (before) q.set("before", before);
  return get<{ messages: T[]; hasMore: boolean }>(`/api/contacts/${conversationId}/messages?${q}`);
}

export function runWinbackScan() {
  return post<{ created: number }>("/api/dev/winback-scan");
}

export function receiveDelivery() {
  return post<{ received: number }>("/api/dev/receive-delivery");
}

export function joinDemo(body: { name: string; handle: string }) {
  return post<{ agentNumber: string; customerId: string; mock?: boolean }>(
    "/api/join",
    body,
  );
}

/** The owner's own message to a customer; `clientId` makes a double click send once. */
export function sendOwnerMessage(conversationId: string, text: string, clientId: string) {
  return post<{ messageId: string; supersededProposals: string[] }>(`/api/conversations/${conversationId}/send`, { text, clientId });
}

export type AssistantRecipient = {
  conversationId: string | null;
  customerId: string | null;
  name: string;
  handleMasked: string;
  reachable: boolean;
  channel: "imessage" | "simulated" | null;
  note: string;
};
export type AssistantAnswer =
  | {
      kind: "stock";
      say: string;
      ingredients: { id: string; name: string; unit: string; onHand: number; onOrder: number; reorderPoint: number; low: boolean }[];
      products: { id: string; name: string; date: string; left: number; capacity: number }[];
    }
  | { kind: "campaign"; say: string; text: string; audience: string; recipients: AssistantRecipient[] }
  | { kind: "call"; say: string; target: string; purpose: string; placed: boolean; callback?: boolean }
  | { kind: "help"; say: string };

export function askAgent(text: string) {
  return post<AssistantAnswer>("/api/assistant/ask", { text });
}

export function sendCampaign(text: string, conversationIds: string[]) {
  return post<{ sent: number; results: { conversationId: string; ok: boolean; error?: string }[] }>("/api/assistant/campaigns/send", {
    text,
    conversationIds,
  });
}

export function syncCalls() {
  return post<{ imported: number }>("/api/assistant/calls/sync");
}

export function reviewCall(callId: string, action: "reviewed" | "skipped") {
  return post<{ callId: string; action: string; already?: boolean }>("/api/assistant/calls/review", { callId, action });
}
