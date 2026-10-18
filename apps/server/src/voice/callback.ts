import { business } from "../business.ts";
import { db } from "../db.ts";
import { env } from "../env.ts";
import { sendAndRecord } from "../execute.ts";
import { logEvent } from "../events.ts";
import { maskHandle, normalizeHandle } from "../inbound.ts";
import { linkCall } from "./calls.ts";

const CALLBACK_TTL_MS = 24 * 60 * 60 * 1000;

export function prettyPhone(e164: string): string {
  const d = e164.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return e164;
}

/** ElevenLabs sometimes stores 206… while we store +1206…. Match both. */
export function phoneKeys(handle: string): string[] {
  const n = normalizeHandle(handle);
  const d = n.replace(/\D/g, "");
  const e164 = d.length === 10 ? `+1${d}` : d.length === 11 && d.startsWith("1") ? `+${d}` : n.startsWith("+") ? n : d ? `+${d}` : n;
  return [...new Set([n, e164, d, d ? `+${d}` : ""].filter(Boolean))];
}

export function shopVoiceNumber(): string | null {
  return env.PHOTON_VOICE_NUMBER ? normalizeHandle(env.PHOTON_VOICE_NUMBER) : null;
}

async function conversationForHandle(handle: string) {
  const { data } = await db().from("conversations").select("*").eq("handle", handle).eq("role", "customer");
  const list = data ?? [];
  return list.find((c) => c.platform === "imessage") ?? list[0] ?? null;
}

type CallbackRow = {
  eventId: string;
  handle: string;
  name: string;
  purpose: string;
  conversationId: string | null;
  at: string;
};

/** Latest unused tap-to-call-back we sent this number, if it is still in the 24-hour window. */
export async function pendingCallback(handle: string): Promise<CallbackRow | null> {
  const want = new Set(phoneKeys(handle));
  const since = new Date(Date.now() - CALLBACK_TTL_MS).toISOString();
  const { data: requested } = await db()
    .from("events")
    .select("id, at, data")
    .eq("type", "call.callback_requested")
    .gte("at", since)
    .order("at", { ascending: false })
    .limit(20);
  const { data: consumed } = await db()
    .from("events")
    .select("data")
    .eq("type", "call.callback_consumed")
    .gte("at", since)
    .limit(50);
  const used = new Set((consumed ?? []).map((e) => String((e.data as { requestedEventId?: unknown }).requestedEventId ?? "")));
  for (const e of requested ?? []) {
    const d = e.data as { handle?: string; name?: string; purpose?: string; conversationId?: string | null };
    if (!phoneKeys(String(d.handle ?? "")).some((k) => want.has(k))) continue;
    if (used.has(String(e.id))) continue;
    return {
      eventId: String(e.id),
      handle: phoneKeys(handle)[0] ?? normalizeHandle(handle),
      name: d.name ?? maskHandle(phoneKeys(handle)[0] ?? handle),
      purpose: d.purpose ?? "a follow-up from the shop",
      conversationId: d.conversationId ?? null,
      at: e.at,
    };
  }
  return null;
}

export async function consumeCallback(handle: string, callId?: string) {
  const pending = await pendingCallback(handle);
  if (!pending) return null;
  if (callId && pending.conversationId) await linkCall(callId, pending.conversationId);
  await logEvent("system", "call.callback_consumed", pending.conversationId ? { type: "conversation", id: pending.conversationId } : null, {
    handle: pending.handle,
    callId: callId ?? null,
    requestedEventId: pending.eventId,
    purpose: pending.purpose,
  });
  return pending;
}

/**
 * Photon's outbound SIP needs a payment method, so we text a tappable shop number instead.
 * The customer dials in; the voice agent looks up why with /voice/tools/purpose.
 */
export async function requestCallback(input: {
  handle: string;
  name: string;
  purpose: string;
}): Promise<{ sent: boolean; reason?: string; conversationId: string | null; number: string | null }> {
  const handle = normalizeHandle(input.handle);
  const number = shopVoiceNumber();
  if (!number) {
    return { sent: false, conversationId: null, number: null, reason: "PHOTON_VOICE_NUMBER is not set, so there is nothing to tap." };
  }
  const conversation = await conversationForHandle(handle);
  if (!conversation) {
    return {
      sent: false,
      conversationId: null,
      number,
      reason: `${input.name} hasn't texted the shop yet, and a shared line can't start a chat.`,
    };
  }
  const existing = await pendingCallback(handle);
  if (existing && existing.purpose === input.purpose) {
    return { sent: true, conversationId: conversation.id, number };
  }
  const line = prettyPhone(number);
  const body = [
    `Hi ${input.name.split(" ")[0]} — ${business.name}. We'd like a quick call about ${input.purpose}.`,
    "",
    "Tap to call us back:",
    line,
  ].join("\n");
  try {
    await sendAndRecord(conversation, `${body}\n${business.poweredByFooter}`, null, `callback:${handle}:${input.purpose.slice(0, 40)}`);
  } catch (err) {
    return {
      sent: false,
      conversationId: conversation.id,
      number,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
  await logEvent("owner", "call.callback_requested", { type: "conversation", id: conversation.id }, {
    handle,
    name: input.name,
    purpose: input.purpose,
    conversationId: conversation.id,
    voiceNumber: maskHandle(number),
  });
  return { sent: true, conversationId: conversation.id, number };
}
