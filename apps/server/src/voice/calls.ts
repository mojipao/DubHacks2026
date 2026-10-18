import { db } from "../db.ts";
import { env } from "../env.ts";
import { HttpError } from "../execute.ts";
import { logEvent } from "../events.ts";
import { maskHandle, normalizeHandle } from "../inbound.ts";

/**
 * Brings finished phone calls from ElevenLabs onto the owner's screen: each call becomes (or joins)
 * a conversation, its turns become messages, and a `call.transcribed` event carries the summary.
 * Polling instead of a webhook means nothing has to be configured in ElevenLabs or exposed publicly.
 */

const BASE = "https://api.elevenlabs.io/v1/convai";
export const callsConfigured = () => Boolean(env.ELEVENLABS_API_KEY && env.ELEVENLABS_AGENT_ID);

async function el<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { "xi-api-key": env.ELEVENLABS_API_KEY!, "content-type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => ({}))) as T & { detail?: unknown };
  if (!res.ok) throw new Error(`ElevenLabs ${path} → ${res.status}: ${JSON.stringify(body.detail ?? body).slice(0, 200)}`);
  return body;
}

interface CallListItem {
  conversation_id: string;
  status: string;
  start_time_unix_secs: number;
  call_duration_secs: number;
}
interface CallDetail {
  conversation_id: string;
  status: string;
  transcript: { role: "user" | "agent"; message: string | null; time_in_call_secs: number }[];
  metadata: { start_time_unix_secs: number; call_duration_secs: number; phone_call?: { external_number?: string; direction?: string } };
  analysis?: { transcript_summary?: string; call_successful?: string };
}

/** The conversation a tool call already tied to this call, if any. */
async function linkedConversation(callId: string): Promise<string | null> {
  const { data } = await db().from("events").select("subject_id").eq("type", "call.linked").eq("data->>callId", callId).limit(1);
  return data?.[0]?.subject_id ?? null;
}

export async function linkCall(callId: string, conversationId: string) {
  if (await linkedConversation(callId)) return;
  await logEvent("system", "call.linked", { type: "conversation", id: conversationId }, { callId });
}

async function alreadySynced(callId: string) {
  const { data } = await db().from("events").select("id").eq("type", "call.transcribed").eq("data->>callId", callId).limit(1);
  return Boolean(data?.length);
}

/** The caller's thread: found by number (and linked to their customer record), or started. No agent run, no owner commands. */
async function callConversation(caller: string): Promise<string> {
  const handle = caller.startsWith("call:") ? caller : normalizeHandle(caller);
  const { data: existing } = await db()
    .from("conversations")
    .select("id")
    .eq("handle", handle)
    .eq("platform", "simulated")
    .eq("role", "customer")
    .maybeSingle();
  if (existing) return existing.id;
  const { data: customer } = await db().from("customers").select("id").eq("handle", handle).maybeSingle();
  // Calls are a customer channel, even when a teammate tests from the owner's phone.
  const { data, error } = await db()
    .from("conversations")
    .insert({ handle, customer_id: customer?.id ?? null, platform: "simulated", role: "customer" })
    .select("id")
    .single();
  if (error) throw new Error(`create call conversation: ${error.message}`);
  return data.id;
}

async function importCall(callId: string): Promise<boolean> {
  const call = await el<CallDetail>(`/conversations/${callId}`);
  if (call.status !== "done") return false;
  const caller = call.metadata.phone_call?.external_number ?? `call:${callId}`;
  const startedAt = call.metadata.start_time_unix_secs * 1000;

  let conversationId = await linkedConversation(callId);
  const turns = call.transcript.filter((t) => t.message && t.message.trim());
  // A call nobody ordered on still lands as a conversation, so every caller shows up as a lead.
  conversationId ??= await callConversation(caller);

  const rows = turns.map((t) => ({
    conversation_id: conversationId!,
    direction: t.role === "user" ? ("inbound" as const) : ("outbound" as const),
    body: t.message!.trim(),
    status: t.role === "user" ? ("received" as const) : ("sent" as const),
    created_at: new Date(startedAt + t.time_in_call_secs * 1000).toISOString(),
  }));
  if (rows.length) {
    const { error } = await db().from("messages").insert(rows);
    if (error) throw new Error(`store call turns: ${error.message}`);
  }
  const endedAt = new Date(startedAt + call.metadata.call_duration_secs * 1000).toISOString();
  await db().from("conversations").update({ last_message_at: endedAt }).eq("id", conversationId);
  await logEvent("system", "call.transcribed", { type: "conversation", id: conversationId }, {
    callId,
    caller: maskHandle(caller),
    startedAt: new Date(startedAt).toISOString(),
    durationSecs: call.metadata.call_duration_secs,
    turns: rows.length,
    summary: call.analysis?.transcript_summary ?? null,
    successful: call.analysis?.call_successful ?? null,
  });
  return true;
}

/** Imports every finished call not seen yet. Returns how many were imported. */
export async function syncCalls(): Promise<number> {
  if (!callsConfigured()) return 0;
  const list = await el<{ conversations: CallListItem[] }>(`/conversations?agent_id=${env.ELEVENLABS_AGENT_ID}&page_size=20`);
  let imported = 0;
  for (const c of list.conversations.filter((c) => c.status === "done").reverse()) {
    if (await alreadySynced(c.conversation_id)) continue;
    if (await importCall(c.conversation_id)) imported++;
  }
  return imported;
}

let timer: NodeJS.Timeout | undefined;
export function startCallSync(everyMs = 20_000) {
  if (!callsConfigured() || timer) return;
  const tick = () =>
    syncCalls()
      .catch((err) => console.error("call sync failed", err instanceof Error ? err.message : err))
      .finally(() => (timer = setTimeout(tick, everyMs)));
  void tick();
}

/** Outbound calling, when the line supports it. Today Photon's outbound SIP needs a payment method first. */
export async function placeCall(toNumber: string, purpose: string): Promise<{ ok: true; callId: string } | { ok: false; reason: string }> {
  if (!callsConfigured()) return { ok: false, reason: "ElevenLabs isn't configured on the server." };
  const numbers = await el<{ phone_number_id: string; supports_outbound?: boolean }[]>("/phone-numbers");
  const line = numbers.find((n) => n.supports_outbound);
  if (!line) {
    return {
      ok: false,
      reason:
        "Outbound calls aren't enabled on the shop's line yet. Photon needs a payment method on the account to turn on outbound SIP (402 ENTITLEMENT_REQUIRED); once it's on, this places the call.",
    };
  }
  const res = await el<{ conversation_id?: string; success?: boolean; message?: string }>("/sip-trunk/outbound-call", {
    method: "POST",
    body: JSON.stringify({
      agent_id: env.ELEVENLABS_AGENT_ID,
      agent_phone_number_id: line.phone_number_id,
      to_number: toNumber,
      conversation_initiation_client_data: { dynamic_variables: { call_purpose: purpose } },
    }),
  });
  return res.conversation_id ? { ok: true, callId: res.conversation_id } : { ok: false, reason: res.message ?? "The call didn't start." };
}

/** Owner marked a transcribed call as seen (or skipped it). Tickets are approved/skipped separately. */
export async function reviewCall(callId: string, action: "reviewed" | "skipped") {
  const { data } = await db().from("events").select("id, subject_id").eq("type", "call.transcribed").eq("data->>callId", callId).limit(1);
  const ev = data?.[0];
  if (!ev) throw new HttpError(404, "No transcribed call with that id");
  const { data: already } = await db().from("events").select("id").eq("type", "call.reviewed").eq("data->>callId", callId).limit(1);
  if (already?.length) return { callId, action, already: true };
  await logEvent("owner", "call.reviewed", ev.subject_id ? { type: "conversation", id: ev.subject_id } : null, { callId, action });
  return { callId, action, already: false };
}
