import { createHash } from "node:crypto";
import { business } from "./business.ts";
import { supabaseDataPort as data } from "./data-port.ts";
import { db } from "./db.ts";
import { logEvent } from "./events.ts";
import { sendAndRecord, HttpError } from "./execute.ts";
import { maskHandle, normalizeHandle } from "./inbound.ts";
import { localDateOf } from "./time.ts";
import { prettyPhone, requestCallback, shopVoiceNumber } from "./voice/callback.ts";
import { placeCall } from "./voice/calls.ts";

/**
 * The owner talking to the agent: "how's our stock?", "text regulars: …", "call Jun about …".
 * Deterministic on purpose: it reads the shop's own numbers and never sends anything without
 * the owner's second press (or SEND by text).
 */

export interface StockReport {
  kind: "stock";
  say: string;
  ingredients: { id: string; name: string; unit: string; onHand: number; onOrder: number; reorderPoint: number; low: boolean }[];
  products: { id: string; name: string; date: string; left: number; capacity: number }[];
}
export interface Recipient {
  conversationId: string | null;
  customerId: string | null;
  name: string;
  handleMasked: string;
  reachable: boolean;
  channel: "imessage" | "simulated" | null;
  note: string;
}
export interface CampaignPreview {
  kind: "campaign";
  say: string;
  text: string;
  audience: string;
  recipients: Recipient[];
}
export interface CallResult {
  kind: "call";
  say: string;
  target: string;
  purpose: string;
  placed: boolean;
  /** True when we texted a tap-to-call-back instead of dialing out. */
  callback?: boolean;
}
export interface Help {
  kind: "help";
  say: string;
}
export type AssistantAnswer = StockReport | CampaignPreview | CallResult | Help;

const HELP_TEXT =
  'Try: "how\'s our stock?", "how much ghee is left?", "text regulars: milk cake is buy one get one today", "text Maya and Jun: …", or "call Jun about his order". Outbound dialing is off, so "call" texts them a tap-to-call-back to the shop line.';

const PHONE = /\+?\d[\d\s().-]{8,}\d/g;

export async function ask(text: string): Promise<AssistantAnswer> {
  const t = text.trim();
  await logEvent("owner", "owner.ask", null, { text: t.slice(0, 300) });
  if (/^\s*(please\s+)?(call|phone|ring)\b/i.test(t)) return callRequest(t);
  if (/^\s*(please\s+)?(text|message|send|blast|tell|let)\b/i.test(t) || /\b(promo|promotion|special|deal)\b/i.test(t)) return campaign(t);
  if (/\b(stock|inventory|on hand|running low|low on|restock|how much|how many|left|supplies)\b/i.test(t)) return stockReport(t);
  return { kind: "help", say: HELP_TEXT };
}

// ---------------------------------------------------------------------------
// Stock
// ---------------------------------------------------------------------------

export async function stockReport(question = ""): Promise<StockReport> {
  const { data: rows, error } = await db().from("ingredients").select("*").order("name");
  if (error) throw new Error(`stock: ${error.message}`);
  const ingredients = (rows ?? []).map((i) => ({
    id: i.id,
    name: i.name,
    unit: i.unit,
    onHand: Number(i.on_hand),
    onOrder: Number(i.on_order),
    reorderPoint: Number(i.reorder_point),
    low: Number(i.on_hand) + Number(i.on_order) < Number(i.reorder_point),
  }));
  const today = localDateOf(new Date(), business.timezone);
  const [catalog, days] = await Promise.all([data.getCatalog(), data.getNextOpenDays(today, 1)]);
  const day = days[0];
  const products = day
    ? catalog
        .filter((p) => ["pastry", "cake", "savory", "bread"].includes(p.category))
        .map((p) => {
          const l = day.load.find((x) => x.productId === p.id);
          return { id: p.id, name: p.name, date: day.localDate, left: l ? Math.max(0, l.capacity - l.committed) : 0, capacity: l?.capacity ?? 0 };
        })
    : [];

  // "how much ghee" answers just ghee; otherwise the whole picture.
  const asked = ingredients.filter((i) => new RegExp(`\\b${i.name.split(" ")[0]}\\b`, "i").test(question));
  const fmt = (i: (typeof ingredients)[number]) => `${i.name} ${round(i.onHand)} ${i.unit}${i.onOrder ? ` (+${round(i.onOrder)} on order)` : ""}`;
  let say: string;
  if (asked.length) {
    say = asked.map((i) => `${fmt(i)}; reorder point ${round(i.reorderPoint)} ${i.unit}${i.low ? ", below it" : ""}.`).join(" ");
  } else {
    const low = ingredients.filter((i) => i.low);
    const tight = products.filter((p) => p.capacity && p.left / p.capacity < 0.35);
    say = [
      low.length ? `Low: ${low.map(fmt).join(", ")}.` : "Nothing is below its reorder point.",
      tight.length && day ? `Filling up ${weekday(day.localDate)}: ${tight.map((p) => `${p.name} ${p.left} of ${p.capacity} left`).join(", ")}.` : null,
      `${ingredients.length - low.length} of ${ingredients.length} ingredients are fine.`,
    ]
      .filter(Boolean)
      .join(" ");
  }
  return { kind: "stock", say, ingredients, products };
}

const round = (n: number) => Math.round(n * 100) / 100;
const weekday = (d: string) => new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));

// ---------------------------------------------------------------------------
// Texts to customers (promotions, specials, follow-ups)
// ---------------------------------------------------------------------------

function splitInstruction(t: string): { audience: string; message: string } {
  const colon = t.indexOf(":");
  if (colon > 0) return { audience: t.slice(0, colon), message: t.slice(colon + 1).trim() };
  const quoted = /["“](.+?)["”]/.exec(t);
  if (quoted) return { audience: t.replace(quoted[0], ""), message: quoted[1]!.trim() };
  const about = /\b(about|that)\b\s+(.+)$/i.exec(t);
  if (about) return { audience: t.slice(0, about.index), message: about[2]!.trim() };
  return { audience: t, message: "" };
}

export async function campaign(t: string): Promise<CampaignPreview> {
  const { audience, message } = splitInstruction(t);
  const text = message
    ? message.charAt(0).toUpperCase() + message.slice(1)
    : `Today at ${business.name}: fresh milk cake and Yemeni coffee from the Haraz mountains. Text us to order ahead.`;

  const [{ data: convs }, { data: customers }, { data: history }] = await Promise.all([
    db().from("conversations").select("id, handle, platform, role, photon_space_id, customer_id, last_message_at").eq("role", "customer"),
    db().from("customers").select("id, name, handle"),
    db().from("orders").select("customer_id").eq("source", "history").limit(10_000),
  ]);
  const counts = new Map<string, number>();
  for (const o of history ?? []) if (o.customer_id) counts.set(o.customer_id, (counts.get(o.customer_id) ?? 0) + 1);
  const nameOf = new Map((customers ?? []).map((c) => [c.id, c.name]));

  const best = (customerId: string | null, handle?: string) => {
    const list = (convs ?? []).filter((c) => (customerId ? c.customer_id === customerId : c.handle === handle));
    // Prefer a real iMessage thread (Photon can reply into it) over a simulated one.
    return list.find((c) => c.platform === "imessage" && c.photon_space_id) ?? list[0] ?? null;
  };
  const toRecipient = (customerId: string | null, handle: string | null, name: string): Recipient => {
    const conv = best(customerId, handle ?? undefined);
    const channel = conv ? (conv.platform === "imessage" ? "imessage" : "simulated") : null;
    return {
      conversationId: conv?.id ?? null,
      customerId,
      name,
      handleMasked: handle ? maskHandle(handle) : conv ? maskHandle(conv.handle) : "no number",
      reachable: Boolean(conv),
      channel,
      note: !conv
        ? "Hasn't texted the shop yet. A shared iMessage line can't start a conversation; send them the QR code."
        : channel === "imessage"
          ? "Delivered by iMessage."
          : "Simulated thread: stored in the log, not delivered to a phone.",
    };
  };

  const a = audience.toLowerCase();
  let label: string;
  let recipients: Recipient[] = [];
  const phones = [...audience.matchAll(PHONE)].map((m) => normalizeHandle(m[0]));
  const named = (customers ?? []).filter((c) => {
    const first = c.name.split(" ")[0]!.toLowerCase();
    return new RegExp(`\\b${first}\\b`, "i").test(audience) && first.length > 2;
  });

  if (phones.length) {
    label = `${phones.length} number${phones.length > 1 ? "s" : ""}`;
    recipients = phones.map((h) => {
      const c = (customers ?? []).find((x) => x.handle === h);
      return toRecipient(c?.id ?? null, h, c?.name ?? maskHandle(h));
    });
  } else if (named.length) {
    label = named.map((c) => c.name).join(", ");
    recipients = named.map((c) => toRecipient(c.id, c.handle, c.name));
  } else if (/\bregulars?\b/.test(a)) {
    label = "regulars";
    recipients = (customers ?? [])
      .filter((c) => (counts.get(c.id) ?? 0) >= business.winbackMinOrders)
      .map((c) => toRecipient(c.id, c.handle, c.name));
  } else if (/\bleads?\b/.test(a)) {
    label = "leads (texted, never ordered)";
    recipients = (convs ?? [])
      .filter((c) => !c.customer_id || !(counts.get(c.customer_id) ?? 0))
      .map((c) => toRecipient(c.customer_id, c.handle, c.customer_id ? (nameOf.get(c.customer_id) ?? maskHandle(c.handle)) : maskHandle(c.handle)));
  } else {
    label = "everyone who has texted the shop";
    recipients = (convs ?? []).map((c) =>
      toRecipient(c.customer_id, c.handle, c.customer_id ? (nameOf.get(c.customer_id) ?? maskHandle(c.handle)) : maskHandle(c.handle)),
    );
  }
  // One message per conversation, reachable ones first.
  const seen = new Set<string>();
  recipients = recipients
    .filter((r) => (r.conversationId ? !seen.has(r.conversationId) && seen.add(r.conversationId) : true))
    .sort((x, y) => Number(y.reachable) - Number(x.reachable));

  const reach = recipients.filter((r) => r.reachable).length;
  return {
    kind: "campaign",
    text,
    audience: label,
    recipients,
    say: recipients.length
      ? `Ready to text ${reach} of ${recipients.length} (${label}).${reach < recipients.length ? ` ${recipients.length - reach} haven't texted the shop yet, so a shared line can't reach them.` : ""}`
      : `Nobody matches "${label}".`,
  };
}

/** Sends the previewed text to the chosen conversations. Owner-only; every send is logged. */
export async function sendCampaign(text: string, conversationIds: string[]) {
  const body = text.trim();
  if (!body || body.length > 1000) throw new HttpError(400, "Message must be 1 to 1000 characters");
  if (body.includes("{{payment_link}}")) throw new HttpError(400, "Payment links come from approving an order ticket");
  const batch = createHash("sha1").update(`${body}|${[...conversationIds].sort().join(",")}`).digest("hex").slice(0, 12);
  const { data: convs } = await db().from("conversations").select("*").in("id", conversationIds).eq("role", "customer");
  const results: { conversationId: string; ok: boolean; error?: string }[] = [];
  for (const c of convs ?? []) {
    try {
      await sendAndRecord(c, `${body}\n${business.poweredByFooter}`, null, `campaign:${batch}:${c.id}`);
      results.push({ conversationId: c.id, ok: true });
    } catch (err) {
      results.push({ conversationId: c.id, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
  await logEvent("owner", "campaign.sent", null, {
    batch,
    text: body.slice(0, 300),
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    conversationIds: results.filter((r) => r.ok).map((r) => r.conversationId),
  });
  return { sent: results.filter((r) => r.ok).length, results };
}

// ---------------------------------------------------------------------------
// Calls
// ---------------------------------------------------------------------------

export async function callRequest(t: string): Promise<CallResult> {
  const phones = [...t.matchAll(PHONE)].map((m) => normalizeHandle(m[0]));
  const { data: customers } = await db().from("customers").select("id, name, handle");
  const person = (customers ?? []).find((c) => new RegExp(`\\b${c.name.split(" ")[0]}\\b`, "i").test(t));
  const number = phones[0] ?? person?.handle ?? null;
  const purpose = (/\b(about|to)\b\s+(.+)$/i.exec(t)?.[2] ?? "a follow-up from the shop").trim();
  const target = person?.name ?? (number ? maskHandle(number) : "someone");
  if (!number) return { kind: "call", say: `I don't have a phone number for ${target}.`, target, purpose, placed: false };
  const res = await placeCall(number, purpose);
  if (res.ok) {
    await logEvent("owner", "call.requested", null, { target, purpose, placed: true, reason: null });
    return {
      kind: "call",
      say: `Calling ${target} now about ${purpose}. The transcript will show up under Calls when it ends.`,
      target,
      purpose,
      placed: true,
    };
  }

  const cb = await requestCallback({ handle: number, name: person?.name ?? target, purpose });
  await logEvent("owner", "call.requested", cb.conversationId ? { type: "conversation", id: cb.conversationId } : null, {
    target,
    purpose,
    placed: false,
    callback: cb.sent,
    reason: cb.sent ? null : `${res.reason}${cb.reason ? ` ${cb.reason}` : ""}`,
  });
  if (cb.sent && cb.number) {
    return {
      kind: "call",
      say: `I can't dial out yet (${res.reason}) so I texted ${target} a tap-to-call-back: ${prettyPhone(cb.number)}. When they call, the agent already knows it's about ${purpose}. Transcript and any order land under Calls.`,
      target,
      purpose,
      placed: false,
      callback: true,
    };
  }
  const shop = shopVoiceNumber();
  const shopLine = shop ? ` They can still call the shop at ${prettyPhone(shop)}.` : "";
  return {
    kind: "call",
    say: `I can't call ${target}: ${res.reason}${cb.reason ? ` ${cb.reason}` : ""}${shopLine}`,
    target,
    purpose,
    placed: false,
  };
}

/** A campaign previewed by text, waiting for the owner's SEND. One at a time is plenty. */
let pendingByText: { preview: CampaignPreview; at: number } | null = null;

/** The owner's free-text message to the shop line. Returns the reply text, or null if it isn't for the assistant. */
export async function answerOwnerText(text: string): Promise<string | null> {
  if (/^\s*send\s*$/i.test(text)) {
    if (!pendingByText || Date.now() - pendingByText.at > 15 * 60_000) return "Nothing waiting to send.";
    const ids = pendingByText.preview.recipients.filter((r) => r.reachable && r.conversationId).map((r) => r.conversationId!);
    const res = await sendCampaign(pendingByText.preview.text, ids);
    pendingByText = null;
    return `Sent to ${res.sent}.`;
  }
  const answer = await ask(text);
  if (answer.kind === "help") return null;
  if (answer.kind === "campaign") {
    pendingByText = { preview: answer, at: Date.now() };
    return `${answer.say}\n"${answer.text}"\nReply SEND to send it.`;
  }
  return answer.say;
}
