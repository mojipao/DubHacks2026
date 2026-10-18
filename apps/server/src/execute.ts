import {
  PAYMENT_LINK_TOKEN,
  ReorderPayload,
  ReplyPayload,
  type Json,
  type OrderDraft,
  type Tables,
} from "@boh/shared";
import { business } from "./business.ts";
import { db } from "./db.ts";
import { logEvent, type Actor } from "./events.ts";

type Proposal = Tables<"proposals">;
type Conversation = Tables<"conversations">;

export interface PricedOrder {
  orderId: string;
  pickupAt: string;
  lines: { name: string; qty: number; unitPriceCents: number }[];
  discountCents?: number;
}

/** Sends a customer message. Real Photon implementation lands in Phase 4. */
export interface Messenger {
  send(input: {
    conversation: Conversation;
    text: string;
    proposalId: string;
    /** Defaults to `proposal:<id>`; owner notifications and confirmations pass their own. */
    idempotencyKey?: string;
  }): Promise<{ photonMessageId: string | null }>;
}

/** Creates one payment link covering every order of a reply. Real Square implementation lands in Phase 5. */
export interface Payments {
  createLink(input: { proposalId: string; customerId: string | null; orders: PricedOrder[] }): Promise<{
    linkId: string;
    url: string;
    squareOrderId: string;
  }>;
}

export const simulatedMessenger: Messenger = {
  async send() {
    return { photonMessageId: null };
  },
};

export const simulatedPayments: Payments = {
  async createLink({ proposalId }) {
    return { linkId: `sim_${proposalId}`, url: `https://simulated.invalid/pay/${proposalId}`, squareOrderId: `sim_${proposalId}` };
  },
};

let messenger: Messenger = simulatedMessenger;
let payments: Payments = simulatedPayments;
export function setIntegrations(next: { messenger?: Messenger; payments?: Payments }) {
  messenger = next.messenger ?? messenger;
  payments = next.payments ?? payments;
}

export class HttpError extends Error {
  constructor(
    readonly status: 409 | 400 | 404 | 502,
    message: string,
  ) {
    super(message);
  }
}

export interface DecisionOptions {
  includeLinked?: boolean;
  actor?: Actor;
  via?: "control_room" | "imessage";
}

/** Approves and executes a pending proposal, then its linked children when asked. A failed child does not undo the parent. */
export async function approve(
  id: string,
  opts: DecisionOptions & { editedText?: string; alternativeIndex?: number } = {},
): Promise<Proposal[]> {
  // Picking one of the agent's alternatives is the same as sending that wording; check it before claiming.
  let text = opts.editedText;
  if (opts.alternativeIndex !== undefined) {
    const current = await fetchProposal(id);
    const alternatives = current.kind === "reply" ? (ReplyPayload.parse(current.payload).alternatives ?? []) : [];
    text = alternatives[opts.alternativeIndex];
    if (text === undefined) throw new HttpError(400, `This proposal has no alternative ${opts.alternativeIndex}`);
  }
  const parent = await claim(id, opts);
  await runExecution(parent, text, true);

  const results = [await fetchProposal(id)];
  if (opts.includeLinked) {
    for (const child of await pendingChildren(id)) {
      try {
        await runExecution(await claim(child.id, opts), undefined, false);
      } catch (err) {
        if (!(err instanceof HttpError && err.status === 409)) console.error("linked execution failed", err);
      }
      results.push(await fetchProposal(child.id));
    }
  }
  return results;
}

export async function reject(id: string, opts: DecisionOptions & { reason?: string } = {}): Promise<Proposal[]> {
  const ids = [id, ...(opts.includeLinked ? (await pendingChildren(id)).map((c) => c.id) : [])];
  const results: Proposal[] = [];
  for (const [i, pid] of ids.entries()) {
    const { data } = await db()
      .from("proposals")
      .update({ status: "rejected", decided_at: new Date().toISOString() })
      .eq("id", pid)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();
    if (!data) {
      if (i === 0) throw new HttpError(409, "Proposal is not pending");
      continue;
    }
    await logEvent(opts.actor ?? "owner", "proposal.rejected", { type: "proposal", id: pid }, {
      reason: opts.reason ?? null,
      via: opts.via ?? "control_room",
    });
    results.push(data);
  }
  return results;
}

/** The atomic pending → executing step: exactly one caller wins a double approve. */
async function claim(id: string, opts: DecisionOptions & { editedText?: string; alternativeIndex?: number }): Promise<Proposal> {
  const { data, error } = await db()
    .from("proposals")
    .update({ status: "executing", decided_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`claim proposal: ${error.message}`);
  if (!data) throw new HttpError(409, "Proposal is not pending");
  await logEvent(opts.actor ?? "owner", "proposal.approved", { type: "proposal", id }, {
    edited: opts.editedText !== undefined,
    alternative: opts.alternativeIndex ?? null,
    via: opts.via ?? "control_room",
  });
  return data;
}

async function runExecution(p: Proposal, editedText: string | undefined, throwOnFail: boolean) {
  try {
    if (p.kind === "reply") await executeReply(p, editedText);
    else await executeReorder(p);
    await db().from("proposals").update({ status: "executed", executed_at: new Date().toISOString() }).eq("id", p.id);
    await logEvent("system", "proposal.executed", { type: "proposal", id: p.id }, { kind: p.kind });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db().from("proposals").update({ status: "failed", error: message }).eq("id", p.id);
    await logEvent("system", "proposal.failed", { type: "proposal", id: p.id }, { error: message });
    if (throwOnFail) throw err instanceof HttpError ? err : new HttpError(502, message);
  }
}

async function executeReply(p: Proposal, editedText: string | undefined) {
  const payload = ReplyPayload.parse(p.payload);
  const text = editedText === undefined ? payload.text : ReplyPayload.shape.text.parse(editedText);
  if (!p.conversation_id) throw new Error("Reply proposal has no conversation");
  const { data: conversation, error } = await db().from("conversations").select("*").eq("id", p.conversation_id).single();
  if (error) throw new Error(`load conversation: ${error.message}`);

  let body = text;
  if (payload.orders.length) {
    const url = await ensureOrdersAndLink(p, conversation.customer_id, payload.orders);
    body = body.includes(PAYMENT_LINK_TOKEN) ? body.replaceAll(PAYMENT_LINK_TOKEN, url) : `${body}\n${url}`;
  }
  body = body.replaceAll(PAYMENT_LINK_TOKEN, "").trimEnd() + `\n${business.poweredByFooter}`;

  await sendAndRecord(conversation, body, p.id);
}

/** Sends through the active Messenger (Photon for iMessage, nothing for simulated), then stores the outbound row and event. */
export async function sendAndRecord(conversation: Conversation, body: string, proposalId: string | null, idempotencyKey?: string) {
  const sent = await messenger.send({ conversation, text: body, proposalId: proposalId ?? "", idempotencyKey });
  const { data: message, error } = await db()
    .from("messages")
    .insert({
      conversation_id: conversation.id,
      direction: "outbound",
      body,
      photon_message_id: sent.photonMessageId,
      status: "sent",
    })
    .select("id")
    .single();
  if (error) throw new Error(`store outbound message: ${error.message}`);
  await db().from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversation.id);
  await logEvent("system", "message.sent", { type: "message", id: message.id }, { proposalId, platform: conversation.platform });
  return message.id;
}

/**
 * The owner writing to a customer directly, with no agent draft. It sends now, closes any pending
 * agent reply in that conversation (the owner has answered), and stays in the thread, so the agents
 * read it as context on the customer's next message.
 */
const ownerSends = new Map<string, Promise<{ messageId: string; supersededProposals: string[] }>>();

export async function sendOwnerMessage(conversationId: string, text: string, opts: { via?: "control_room" | "imessage"; clientId?: string } = {}) {
  if (!opts.clientId) return doSendOwnerMessage(conversationId, text, opts);
  // A repeated clientId (double click, network retry) returns the first send instead of sending again.
  const { data: earlier } = await db()
    .from("events")
    .select("subject_id")
    .eq("type", "owner.message")
    .eq("data->>clientId", opts.clientId)
    .limit(1);
  if (earlier?.[0]?.subject_id) return { messageId: earlier[0].subject_id, supersededProposals: [], duplicate: true };
  const inFlight = ownerSends.get(opts.clientId);
  if (inFlight) return { ...(await inFlight), duplicate: true };
  const send = doSendOwnerMessage(conversationId, text, opts).finally(() => setTimeout(() => ownerSends.delete(opts.clientId!), 60_000));
  ownerSends.set(opts.clientId, send);
  return send;
}

async function doSendOwnerMessage(conversationId: string, text: string, opts: { via?: "control_room" | "imessage"; clientId?: string }) {
  const body = ReplyPayload.shape.text.parse(text.trim());
  const { data: conversation, error } = await db().from("conversations").select("*").eq("id", conversationId).maybeSingle();
  if (error) throw new Error(`load conversation: ${error.message}`);
  if (!conversation) throw new HttpError(404, "Conversation not found");
  if (body.includes(PAYMENT_LINK_TOKEN)) throw new HttpError(400, "Payment links come from approving an order ticket, not from a typed message");

  const { data: superseded } = await db()
    .from("proposals")
    .update({ status: "superseded", decided_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("kind", "reply")
    .eq("status", "pending")
    .select("id");
  for (const p of superseded ?? []) {
    await logEvent("owner", "proposal.superseded", { type: "proposal", id: p.id }, { reason: "owner_replied" });
  }

  // Customer replies carry the footer like every agent reply; notes to the owner's own thread don't.
  const out = conversation.role === "customer" ? `${body}\n${business.poweredByFooter}` : body;
  const key = `owner-message:${opts.clientId ?? crypto.randomUUID()}`;
  const messageId = await sendAndRecord(conversation, out, null, key);
  await logEvent("owner", "owner.message", { type: "message", id: messageId }, {
    conversationId,
    clientId: opts.clientId ?? null,
    via: opts.via ?? "control_room",
    supersededProposals: (superseded ?? []).map((p) => p.id),
  });
  return { messageId, supersededProposals: (superseded ?? []).map((p) => p.id) };
}

/**
 * Creates the reply's orders and its one payment link, or reuses them when a retry finds them
 * already stored, so a retry after a Photon failure resends without charging twice.
 */
async function ensureOrdersAndLink(p: Proposal, customerId: string | null, drafts: OrderDraft[]): Promise<string> {
  const { data: existing, error } = await db()
    .from("orders")
    .select("id, pickup_at, discount_cents, payment_url, order_items(product_id, qty, unit_price_cents, products(name))")
    .eq("proposal_id", p.id);
  if (error) throw new Error(`load existing orders: ${error.message}`);
  const storedUrl = existing?.find((o) => o.payment_url)?.payment_url;
  if (storedUrl) return storedUrl;

  const priced: PricedOrder[] = existing?.length
    ? existing.map((o) => ({
        orderId: o.id,
        pickupAt: o.pickup_at,
        discountCents: o.discount_cents,
        lines: o.order_items.map((i) => ({ name: i.products?.name ?? i.product_id, qty: i.qty, unitPriceCents: i.unit_price_cents })),
      }))
    : await createOrders(p, customerId, drafts);

  const link = await payments.createLink({ proposalId: p.id, customerId, orders: priced });
  const orderIds = priced.map((o) => o.orderId);
  const { error: linkError } = await db()
    .from("orders")
    .update({ square_order_id: link.squareOrderId, square_payment_link_id: link.linkId, payment_url: link.url })
    .in("id", orderIds);
  if (linkError) throw new Error(`store payment link: ${linkError.message}`);
  for (const orderId of orderIds) {
    await logEvent("system", "payment_link.created", { type: "order", id: orderId }, { linkId: link.linkId });
  }
  return link.url;
}

/** Re-runs a failed proposal. Stored orders and payment links are reused. */
export async function retry(id: string, opts: DecisionOptions = {}): Promise<Proposal[]> {
  const { data, error } = await db()
    .from("proposals")
    .update({ status: "executing", error: null })
    .eq("id", id)
    .eq("status", "failed")
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`claim retry: ${error.message}`);
  if (!data) throw new HttpError(409, "Proposal is not failed");
  await logEvent(opts.actor ?? "owner", "proposal.approved", { type: "proposal", id }, { retry: true, via: opts.via ?? "control_room" });
  await runExecution(data, undefined, true);
  return [await fetchProposal(id)];
}

const WELCOME_BACK_RATE = 0.1;

/** The server, not the agent, decides perk eligibility: a returning customer whose last past pickup is old enough. */
async function perkEligible(customerId: string | null): Promise<boolean> {
  if (!customerId) return false;
  const { data } = await db()
    .from("orders")
    .select("pickup_at")
    .eq("customer_id", customerId)
    .in("status", ["paid", "fulfilled"])
    .lte("pickup_at", new Date().toISOString())
    .order("pickup_at", { ascending: false })
    .limit(1);
  const last = data?.[0];
  if (!last) return false;
  return Date.now() - Date.parse(last.pickup_at) >= business.welcomeBackAfterDays * 86_400_000;
}

/** Prices every line from the products table. Agents never set a price. The perk applies once per reply. */
async function createOrders(p: Proposal, customerId: string | null, drafts: OrderDraft[]): Promise<PricedOrder[]> {
  let perkAvailable = drafts.some((d) => d.perk === "welcome_back_10") && (await perkEligible(customerId));
  const productIds = [...new Set(drafts.flatMap((o) => o.items.map((i) => i.productId)))];
  const { data: products, error } = await db().from("products").select("id, name, price_cents").in("id", productIds);
  if (error) throw new Error(`load products: ${error.message}`);
  const byId = new Map(products.map((prod) => [prod.id, prod]));

  const priced: PricedOrder[] = [];
  for (const draft of drafts) {
    const lines = draft.items.map((item) => {
      const product = byId.get(item.productId);
      if (!product) throw new Error(`Unknown product ${item.productId}`);
      return { productId: product.id, name: product.name, qty: item.qty, unitPriceCents: product.price_cents };
    });
    const total = lines.reduce((sum, l) => sum + l.qty * l.unitPriceCents, 0);
    const discount = perkAvailable && draft.perk === "welcome_back_10" ? Math.round(total * WELCOME_BACK_RATE) : 0;
    if (discount) perkAvailable = false;
    const { data: order, error: orderError } = await db()
      .from("orders")
      .insert({
        customer_id: customerId,
        source: "agent",
        status: "awaiting_payment",
        pickup_at: draft.pickupAt,
        total_cents: total,
        discount_cents: discount,
        proposal_id: p.id,
      })
      .select("id")
      .single();
    if (orderError) throw new Error(`insert order: ${orderError.message}`);
    const { error: itemsError } = await db()
      .from("order_items")
      .insert(lines.map((l) => ({ order_id: order.id, product_id: l.productId, qty: l.qty, unit_price_cents: l.unitPriceCents })));
    if (itemsError) throw new Error(`insert order items: ${itemsError.message}`);
    await logEvent("system", "order.created", { type: "order", id: order.id }, {
      proposalId: p.id,
      totalCents: total,
      discountCents: discount,
      pickupAt: draft.pickupAt,
    } as Record<string, Json>);
    priced.push({ orderId: order.id, pickupAt: draft.pickupAt, lines, discountCents: discount });
  }
  return priced;
}

/** Supplier delivery is simulated: approval only raises on_order. */
async function executeReorder(p: Proposal) {
  const payload = ReorderPayload.parse(p.payload);
  for (const line of payload.lines) {
    const { data: ingredient, error } = await db().from("ingredients").select("id, on_order").eq("id", line.ingredientId).maybeSingle();
    if (error) throw new Error(`load ingredient ${line.ingredientId}: ${error.message}`);
    if (!ingredient) throw new Error(`Unknown ingredient ${line.ingredientId}`);
    const onOrder = Number(ingredient.on_order) + line.qty;
    const { error: updateError } = await db().from("ingredients").update({ on_order: onOrder }).eq("id", ingredient.id);
    if (updateError) throw new Error(`update ingredient ${line.ingredientId}: ${updateError.message}`);
    await logEvent("system", "inventory.reordered", { type: "ingredient", id: ingredient.id }, {
      proposalId: p.id,
      qty: line.qty,
      supplier: payload.supplier,
      simulated: true,
    });
  }
}

async function fetchProposal(id: string): Promise<Proposal> {
  const { data, error } = await db().from("proposals").select("*").eq("id", id).single();
  if (error) throw new Error(`load proposal: ${error.message}`);
  return data;
}

async function pendingChildren(parentId: string) {
  const { data } = await db()
    .from("proposals")
    .select("id")
    .eq("parent_proposal_id", parentId)
    .eq("status", "pending")
    .order("created_at");
  return data ?? [];
}
