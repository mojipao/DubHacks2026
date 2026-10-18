import { ProposalDraft, ReplyPayload, type Json } from "@boh/shared";
import { business } from "./business.ts";
import { db } from "./db.ts";
import { env } from "./env.ts";
import { logEvent } from "./events.ts";
import { approve, perkEligible, sendAndRecord } from "./execute.ts";
import { contains, declaredAllergies, productFacts } from "./facts.ts";
import { storeDrafts } from "./inbound.ts";

/**
 * How much the agent does on its own. The rule is commitment, not cleverness:
 * - Questions, answers and clarifications go out without the owner (logged as `via: "agent"`).
 * - An order is first checked with the customer (items, sizes, allergens, total) and only reaches
 *   the owner's pass after the customer says yes. The owner still approves every order and payment.
 * - Anything Guard flags, complaints, allergy talk, big orders, or low confidence waits for the owner.
 * `AUTONOMY=off` puts every draft back on the pass.
 */
export const autonomyOn = () => env.AUTONOMY !== "off";

const OWNER_ONLY = new Set(["injection_suspected", "off_policy", "abusive", "complaint", "allergy_mentioned", "large_order", "low_confidence"]);
const HOLD_HOURS = 24;

const agentMaySend = (d: ProposalDraft) =>
  d.kind === "reply" && d.payload.orders.length === 0 && d.parentIndex === undefined && !d.riskFlags.some((f) => OWNER_ONLY.has(f));

/** Decides what happens to one agent run's drafts. */
export async function routeDrafts(raw: unknown[], conversationId: string, messageId: string) {
  if (!autonomyOn()) return void (await storeDrafts(raw, conversationId, messageId));

  const parsed = raw.map((r) => ProposalDraft.safeParse(r));
  const drafts = parsed.flatMap((p) => (p.success ? [p.data] : []));
  const order = drafts.find((d) => d.kind === "reply" && d.payload.orders.length > 0 && d.parentIndex === undefined);
  const guarded = drafts.some((d) => d.riskFlags.some((f) => ["injection_suspected", "off_policy", "abusive"].includes(f)));

  if (order && order.kind === "reply" && !guarded) return holdOrder(raw, order, conversationId, messageId);

  const ids = await storeDrafts(raw, conversationId, messageId, { quiet: agentMaySend });
  for (const [i, id] of ids.entries()) {
    const p = parsed[i];
    if (!id || !p?.success || !agentMaySend(p.data)) continue;
    try {
      await approve(id, { actor: "agent:intake", via: "agent" });
    } catch (err) {
      // Left pending for the owner if the send fails.
      console.error("autonomous send failed", err);
    }
  }
}

// ---------------------------------------------------------------------------
// The order check-in
// ---------------------------------------------------------------------------

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function pickupLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: business.timezone,
    weekday: "short",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Builds the check-in from data only: no model writes it, so nothing in it can be invented. */
async function checkInText(order: Extract<ProposalDraft, { kind: "reply" }>, conversationId: string) {
  const { data: conv } = await db().from("conversations").select("customer_id, customers(name, notes)").eq("id", conversationId).single();
  const name = conv?.customers?.name?.split(" ")[0];
  const ids = [...new Set(order.payload.orders.flatMap((o) => o.items.map((i) => i.productId)))];
  const { data: products } = await db().from("products").select("id, name, price_cents").in("id", ids);
  const byId = new Map((products ?? []).map((p) => [p.id, p]));

  const lines: string[] = [];
  let total = 0;
  for (const o of order.payload.orders) {
    for (const item of o.items) {
      const p = byId.get(item.productId);
      if (!p) continue;
      total += p.price_cents * item.qty;
      const size = productFacts[item.productId]?.size;
      lines.push(`• ${item.qty}× ${p.name}${size ? ` (${size})` : ""}, ${pickupLabel(o.pickupAt)}`);
    }
  }

  const allergenLines: string[] = [];
  for (const id of ids) {
    const facts = productFacts[id];
    if (facts?.allergens.length) allergenLines.push(`${byId.get(id)?.name ?? id}: ${facts.allergens.join(", ")}`);
  }
  const declared = declaredAllergies(conv?.customers?.notes);
  const conflicts = declared.flatMap((a) => ids.filter((id) => contains(id, a)).map((id) => ({ a, name: byId.get(id)?.name ?? id })));

  const perk =
    order.payload.orders.some((o) => o.perk === "welcome_back_10") && (await perkEligible(conv?.customer_id ?? null))
      ? " The 10% welcome-back discount comes off at checkout."
      : "";

  return [
    `${name ? `Hi ${name}, b` : "B"}efore I send this over, here's what I have:`,
    ...lines,
    order.payload.orders.length > 1 ? "That's split across two pickups because the first day is nearly full." : null,
    `Total ${money(total)}.${perk}`,
    allergenLines.length ? `Contains: ${allergenLines.join("; ")}.` : null,
    ...conflicts.map((c) => `Heads up: your notes mention a ${c.a.replace(/s$/, "")} allergy, and ${c.name} contains ${c.a}.`),
    "Want me to send it to the owner to confirm? Reply YES to continue or NO to cancel.",
    business.poweredByFooter,
  ]
    .filter(Boolean)
    .join("\n");
}

async function holdOrder(raw: unknown[], order: Extract<ProposalDraft, { kind: "reply" }>, conversationId: string, messageId: string) {
  const { data: conversation } = await db().from("conversations").select("*").eq("id", conversationId).single();
  if (!conversation) return;
  const text = await checkInText(order, conversationId);
  const sentId = await sendAndRecord(conversation, text, null, `hold:${messageId}`);
  const expiresAt = new Date(Date.now() + HOLD_HOURS * 3_600_000).toISOString();
  await logEvent("agent:intake", "order.held", { type: "conversation", id: conversationId }, {
    messageId,
    checkInMessageId: sentId,
    drafts: raw as Json,
    title: order.title,
    summary: order.summary,
    expiresAt,
  });
  await logEvent("agent:intake", "agent.step", { type: "message", id: messageId }, {
    agent: "intake",
    step: "confirm",
    ms: 0,
    summary: "Checked the order with the customer (items, sizes, allergens, total) before sending it to the owner",
    reads: [{ table: "products", id: order.payload.orders[0]?.items[0]?.productId ?? "" }],
    flags: [],
  });
}

// ---------------------------------------------------------------------------
// The customer's answer
// ---------------------------------------------------------------------------

const YES = /^\s*(y|yes|yea|yeah|yep|yup|sure|ok|okay|k|confirm(ed)?|go ahead|go for it|please do|do it|sounds good|perfect|great|place it|let'?s do it|👍|✅)\b/i;
const NO = /^\s*(n|no|nope|nah|cancel|never ?mind|nvm|don'?t|stop|not now|no thanks)\b/i;
const short = (t: string) => t.trim().split(/\s+/).length <= 6;

interface Hold {
  eventId: number;
  messageId: string;
  drafts: unknown[];
  expiresAt: string;
}

async function openHold(conversationId: string): Promise<Hold | null> {
  const { data } = await db()
    .from("events")
    .select("id, type, data")
    .eq("subject_type", "conversation")
    .eq("subject_id", conversationId)
    .in("type", ["order.held", "order.hold_closed"])
    .order("id", { ascending: false })
    .limit(1);
  const e = data?.[0];
  if (!e || e.type !== "order.held") return null;
  const d = e.data as { messageId: string; drafts: unknown[]; expiresAt: string };
  if (Date.parse(d.expiresAt) < Date.now()) return null;
  return { eventId: e.id, messageId: d.messageId, drafts: d.drafts, expiresAt: d.expiresAt };
}

async function close(conversationId: string, hold: Hold, outcome: "confirmed" | "declined" | "changed", data: Record<string, unknown> = {}) {
  await logEvent(outcome === "changed" ? "system" : "customer", "order.hold_closed", { type: "conversation", id: conversationId }, {
    heldEventId: hold.eventId,
    outcome,
    ...data,
  });
}

/**
 * Called on every customer text. True when it answered an open check-in (so no agent run is needed).
 * Anything other than a short yes or no closes the check-in and lets the agents read the new text.
 */
export async function answerHold(conversationId: string, messageId: string, text: string): Promise<boolean> {
  if (!autonomyOn()) return false;
  const hold = await openHold(conversationId);
  if (!hold) return false;
  const { data: conversation } = await db().from("conversations").select("*").eq("id", conversationId).single();
  if (!conversation) return false;

  if (short(text) && YES.test(text)) {
    const ids = (await storeDrafts(hold.drafts, conversationId, hold.messageId)).filter(Boolean);
    await close(conversationId, hold, "confirmed", { proposalIds: ids, answerMessageId: messageId });
    await sendAndRecord(
      conversation,
      `Great, it's with the owner now. You'll get the payment link here as soon as they confirm.\n${business.poweredByFooter}`,
      null,
      `hold-yes:${messageId}`,
    );
    return true;
  }
  if (short(text) && NO.test(text)) {
    await close(conversationId, hold, "declined", { answerMessageId: messageId });
    await sendAndRecord(conversation, `No problem, I've cancelled it. Anything else I can get you?\n${business.poweredByFooter}`, null, `hold-no:${messageId}`);
    return true;
  }
  await close(conversationId, hold, "changed", { answerMessageId: messageId });
  return false;
}

/** Plain-text summary of a held order for the owner's views. */
export function heldSummary(drafts: unknown[]): string {
  const reply = drafts.map((d) => ProposalDraft.safeParse(d)).find((p) => p.success && p.data.kind === "reply");
  if (!reply?.success || reply.data.kind !== "reply") return "";
  const payload = ReplyPayload.parse(reply.data.payload);
  return payload.orders.map((o) => o.items.map((i) => `${i.qty}× ${i.productId}`).join(", ")).join(" + ");
}
