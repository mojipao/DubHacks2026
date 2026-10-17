import { PAYMENT_LINK_TOKEN, type ReplyPayload, type ReorderPayload } from "@boh/shared";
import recipesJson from "../../../../../data/seed/recipes.json";
import { BUSINESS, PRODUCT_NAMES, PRODUCT_PRICES } from "@/lib/business";
import { computeFriction } from "@/lib/data/friction";
import type { DataSnapshot, DataSource } from "@/lib/data/source";
import type { UiEvent, UiMessage, UiOrder, UiProposal } from "@/lib/data/types";
import {
  FIXTURE_CONVERSATIONS,
  FIXTURE_CUSTOMER_LIST,
  FIXTURE_EVENTS,
  FIXTURE_INGREDIENTS,
  FIXTURE_MESSAGES,
  FIXTURE_ORDERS,
  FIXTURE_PROPOSALS,
  FIXTURE_SAT_PICKUP,
  FIXTURE_TRACE,
} from "@/mocks/fixtures";
import { scriptFor } from "@/mocks/scenarios";

const STEP_MS = 380;
const EXECUTE_MS = 450;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let seq = 0;
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

function frictionOf(snap: Pick<DataSnapshot, "events" | "proposals">) {
  return computeFriction(snap.events, new Map(snap.proposals.map((p) => [p.id, p])));
}

/** Fixture traces become ordinary agent.step events, so mock and live render traces the same way. */
function fixtureEvents(): UiEvent[] {
  const traceEvents: UiEvent[] = Object.entries(FIXTURE_TRACE).flatMap(([messageId, steps]) =>
    steps.map((s) => ({
      id: `trace-${s.id}`,
      at: s.at,
      actor: `agent:${s.agent}`,
      type: "agent.step",
      subjectType: "message",
      subjectId: messageId,
      data: { agent: s.agent, step: s.step, ms: s.ms, summary: s.summary, reads: s.reads, flags: s.flags },
    })),
  );
  // Every fixture ticket was drafted at some point, so the friction tally counts it like a live one.
  const created: UiEvent[] = FIXTURE_PROPOSALS.map((p) => ({
    id: `created-${p.id}`,
    at: p.createdAt,
    actor: `agent:${p.agent}`,
    type: "proposal.created",
    subjectType: "proposal",
    subjectId: p.id,
    data: { kind: p.kind },
  }));
  return [...FIXTURE_EVENTS.filter((e) => e.type !== "agent.step"), ...traceEvents, ...created].sort(
    (a, b) => Date.parse(b.at) - Date.parse(a.at),
  );
}

function cloneSnapshot(): DataSnapshot {
  const snap: DataSnapshot = {
    customers: structuredClone(FIXTURE_CUSTOMER_LIST),
    conversations: structuredClone(FIXTURE_CONVERSATIONS),
    messages: structuredClone(FIXTURE_MESSAGES),
    proposals: structuredClone(FIXTURE_PROPOSALS),
    orders: structuredClone(FIXTURE_ORDERS),
    ingredients: structuredClone(FIXTURE_INGREDIENTS),
    events: fixtureEvents(),
    friction: { messagesHandled: 0, ordersCreated: 0, reordersDrafted: 0, guardCatches: 0, ownerMinutesSaved: 0 },
    connection: "mock",
  };
  snap.friction = frictionOf(snap);
  return snap;
}

/** Synchronous snapshot for first paint (avoids an empty control room flash). */
export function getMockSnapshot(): DataSnapshot {
  return cloneSnapshot();
}

function priceOrder(order: ReplyPayload["orders"][number]) {
  const total = order.items.reduce((n, i) => n + (PRODUCT_PRICES[i.productId] ?? 0) * i.qty, 0);
  return { total, discount: order.perk === "welcome_back_10" ? Math.round(total * 0.1) : 0 };
}

/** In-memory stand-in for the server: same state transitions and the same events, no network. */
export function createMockSource(): DataSource {
  const snap = cloneSnapshot();
  const listeners = new Set<(patch: Partial<DataSnapshot>) => void>();

  const log = (e: Omit<UiEvent, "id" | "at"> & { at?: string }) => {
    snap.events = [{ id: uid("evt"), at: e.at ?? new Date().toISOString(), ...e }, ...snap.events].slice(0, 500);
  };

  /** Pushes the current state of the named slices to subscribers; friction always follows events. */
  const commit = (...keys: (keyof DataSnapshot)[]) => {
    snap.friction = frictionOf(snap);
    snap.conversations = snap.conversations.map((c) => ({
      ...c,
      hasPendingTicket: snap.proposals.some((p) => p.conversationId === c.id && p.status === "pending"),
    }));
    const patch: Partial<DataSnapshot> = { friction: snap.friction, conversations: snap.conversations };
    for (const k of keys) Object.assign(patch, { [k]: snap[k] });
    for (const l of listeners) l(patch);
  };

  const setProposals = (ids: string[], patch: Partial<UiProposal>) => {
    snap.proposals = snap.proposals.map((p) => (ids.includes(p.id) ? { ...p, ...patch } : p));
  };

  const addMessage = (conversationId: string, direction: UiMessage["direction"], body: string) => {
    const at = new Date().toISOString();
    const message: UiMessage = {
      id: uid("msg"),
      conversationId,
      direction,
      body,
      status: direction === "inbound" ? "received" : "sent",
      createdAt: at,
      approvedByOwner: direction === "outbound",
    };
    snap.messages = [...snap.messages, message];
    snap.conversations = snap.conversations.map((c) =>
      c.id === conversationId ? { ...c, lastMessageAt: at, lastPreview: body.slice(0, 80) } : c,
    );
    return message;
  };

  const executeOne = (p: UiProposal, via: "control_room" | "imessage", editedText?: string) => {
    if (p.kind === "reply") {
      const payload = p.payload as ReplyPayload;
      const link = `https://square.link/u/${uid("demo")}`;
      const conv = snap.conversations.find((c) => c.id === p.conversationId);
      for (const draft of payload.orders) {
        const { total, discount } = priceOrder(draft);
        const order: UiOrder = {
          id: uid("order"),
          customerId: conv?.customerId ?? null,
          customerName: p.customerName,
          status: "awaiting_payment",
          pickupAt: draft.pickupAt,
          totalCents: total,
          discountCents: discount,
          source: "agent",
          createdAt: new Date().toISOString(),
          paidAt: null,
          items: draft.items.map((i) => ({
            productId: i.productId,
            name: PRODUCT_NAMES[i.productId] ?? i.productId,
            qty: i.qty,
          })),
        };
        snap.orders = [...snap.orders, order];
        log({ actor: "system", type: "order.created", subjectType: "order", subjectId: order.id, data: { proposalId: p.id } });
      }
      let text = editedText ?? payload.text;
      if (payload.orders.length > 0) {
        log({ actor: "square", type: "payment_link.created", subjectType: "order", subjectId: snap.orders.at(-1)!.id, data: { simulated: true } });
        text = text.includes(PAYMENT_LINK_TOKEN) ? text.replace(PAYMENT_LINK_TOKEN, link) : `${text}\n${link}`;
      }
      text = `${text}\n${BUSINESS.poweredByFooter}`;
      if (p.conversationId) {
        const msg = addMessage(p.conversationId, "outbound", text);
        log({ actor: "system", type: "message.sent", subjectType: "message", subjectId: msg.id, data: { proposalId: p.id, platform: conv?.platform ?? "simulated" } });
      }
    } else {
      const payload = p.payload as ReorderPayload;
      snap.ingredients = snap.ingredients.map((ing) => {
        const line = payload.lines.find((l) => l.ingredientId === ing.id);
        return line ? { ...ing, onOrder: Math.round((ing.onOrder + line.qty) * 100) / 100 } : ing;
      });
      for (const line of payload.lines) {
        log({ actor: "system", type: "inventory.reordered", subjectType: "ingredient", subjectId: line.ingredientId, data: { qty: line.qty, supplier: payload.supplier } });
      }
    }
    const at = new Date().toISOString();
    setProposals([p.id], { status: "executed", executedAt: at, approvedVia: via === "imessage" ? "imessage" : "ui" });
    log({ actor: "system", type: "proposal.executed", subjectType: "proposal", subjectId: p.id, data: { kind: p.kind } });
  };

  const approveIds = async (id: string, opts: { includeLinked?: boolean; editedText?: string }, via: "control_room" | "imessage") => {
    const target = snap.proposals.find((p) => p.id === id);
    if (!target || target.status !== "pending") {
      throw Object.assign(new Error("Proposal is not pending"), { status: 409 });
    }
    const ids = [id];
    if (opts.includeLinked) {
      ids.push(...snap.proposals.filter((c) => c.parentProposalId === id && c.status === "pending").map((c) => c.id));
    }
    const at = new Date().toISOString();
    setProposals(ids, { status: "executing", decidedAt: at });
    for (const pid of ids) {
      log({ actor: "owner", type: "proposal.approved", subjectType: "proposal", subjectId: pid, data: { via, edited: pid === id && opts.editedText !== undefined } });
    }
    commit("proposals", "events");
    await sleep(EXECUTE_MS);
    // Parent first, then children, as the server does.
    for (const pid of ids) {
      const p = snap.proposals.find((x) => x.id === pid);
      if (p) executeOne(p, via, pid === id ? opts.editedText : undefined);
    }
    commit("proposals", "events", "messages", "orders", "ingredients");
    return ids;
  };

  const rejectIds = (id: string, opts: { includeLinked?: boolean; reason?: string }, via: "control_room" | "imessage") => {
    const target = snap.proposals.find((p) => p.id === id);
    if (!target || target.status !== "pending") {
      throw Object.assign(new Error("Proposal is not pending"), { status: 409 });
    }
    const ids = [id];
    if (opts.includeLinked) {
      ids.push(...snap.proposals.filter((c) => c.parentProposalId === id && c.status === "pending").map((c) => c.id));
    }
    setProposals(ids, { status: "rejected", decidedAt: new Date().toISOString() });
    for (const pid of ids) {
      log({ actor: "owner", type: "proposal.rejected", subjectType: "proposal", subjectId: pid, data: { reason: opts.reason ?? null, via } });
    }
    commit("proposals", "events");
    return ids;
  };

  /** The owner texting the shop line: Y approves, N rejects, ? lists. Mirrors the server's parser. */
  const ownerCommand = async (conversationId: string, raw: string) => {
    const [verbRaw, code] = raw.trim().split(/\s+/);
    const verb = (verbRaw ?? "").toUpperCase();
    const pending = snap.proposals.filter((p) => p.status === "pending" && !p.parentProposalId);
    const reply = (text: string) => {
      addMessage(conversationId, "outbound", text);
      commit("messages");
    };
    if (verb === "?") {
      log({ actor: "owner", type: "owner.command", subjectType: null, subjectId: null, data: { command: "list", count: pending.length } });
      reply(
        pending.length === 0
          ? "Nothing waiting."
          : pending.map((p) => `${p.shortCode ?? "··"} · ${p.customerName ?? "Unknown"}: ${p.rationale}`).join("\n"),
      );
      return;
    }
    if (verb !== "Y" && verb !== "N") {
      log({ actor: "owner", type: "owner.command", subjectType: null, subjectId: null, data: { command: "unknown", text: raw.slice(0, 80) } });
      reply("Reply Y to approve, N to skip, ? to list what's waiting.");
      return;
    }
    const target = code ? pending.find((p) => p.shortCode?.toUpperCase() === code.toUpperCase()) : pending[0];
    if (!target) {
      reply(code ? `No pending ticket ${code}.` : "Nothing waiting.");
      return;
    }
    log({ actor: "owner", type: "owner.command", subjectType: "proposal", subjectId: target.id, data: { command: verb === "Y" ? "approve" : "reject", code: code ?? null } });
    if (verb === "Y") {
      const ids = await approveIds(target.id, { includeLinked: true }, "imessage");
      reply(`Sent to ${target.customerName ?? "the customer"} ✓${ids.length > 1 ? " · reorder placed" : ""}`);
    } else {
      rejectIds(target.id, { includeLinked: true }, "imessage");
      reply(`Skipped ${target.customerName ?? "that one"}.`);
    }
  };

  return {
    mode: "mock",
    async load() {
      return structuredClone(snap);
    },
    subscribe(onChange) {
      listeners.add(onChange);
      return () => void listeners.delete(onChange);
    },
    async approve(id, opts) {
      await approveIds(id, opts ?? {}, "control_room");
    },
    async reject(id, opts) {
      rejectIds(id, opts ?? {}, "control_room");
    },
    async retry(id) {
      const target = snap.proposals.find((p) => p.id === id);
      if (!target || target.status !== "failed") {
        throw Object.assign(new Error("Only failed tickets can be retried"), { status: 409 });
      }
      setProposals([id], { status: "executing", error: null });
      log({ actor: "owner", type: "proposal.approved", subjectType: "proposal", subjectId: id, data: { retry: true, via: "control_room" } });
      commit("proposals", "events");
      await sleep(EXECUTE_MS);
      executeOne(target, "control_room");
      commit("proposals", "events", "messages", "orders", "ingredients");
    },
    async markPaid(orderId) {
      const order = snap.orders.find((o) => o.id === orderId);
      if (!order || order.status !== "awaiting_payment") return;
      const at = new Date().toISOString();
      snap.orders = snap.orders.map((o) => (o.id === orderId ? { ...o, status: "paid" as const, paidAt: at } : o));
      log({ actor: "owner", type: "order.paid", subjectType: "order", subjectId: orderId, data: { via: "dev/mark-paid" } });
      // Same deduction as the server's settle path, from the seed recipes.
      const deduct = new Map<string, number>();
      for (const item of order.items) {
        for (const line of recipesJson.filter((r) => r.productId === item.productId)) {
          deduct.set(line.ingredientId, (deduct.get(line.ingredientId) ?? 0) + item.qty * line.qtyPerUnit);
        }
      }
      snap.ingredients = snap.ingredients.map((ing) => {
        const amount = deduct.get(ing.id);
        return amount ? { ...ing, onHand: Math.max(0, Math.round((ing.onHand - amount) * 1000) / 1000) } : ing;
      });
      for (const [ingredientId, amount] of deduct) {
        log({ actor: "system", type: "inventory.deducted", subjectType: "ingredient", subjectId: ingredientId, data: { amount: Math.round(amount * 1000) / 1000, orderIds: [orderId] } });
      }
      commit("orders", "ingredients", "events");
    },
    async winbackScan() {
      const elena = snap.customers.find((c) => c.id === "cust-elena");
      if (!elena || snap.proposals.some((p) => p.agent === "winback" && p.status === "pending")) {
        log({ actor: "system", type: "winback.scanned", subjectType: null, subjectId: null, data: { candidates: 0 } });
        commit("events");
        return 0;
      }
      const conversationId = "conv-elena";
      if (!snap.conversations.some((c) => c.id === conversationId)) {
        snap.conversations = [
          ...snap.conversations,
          {
            id: conversationId,
            customerId: elena.id,
            handle: elena.handle ?? "",
            customerName: elena.name,
            platform: "imessage",
            role: "customer",
            lastMessageAt: new Date().toISOString(),
            lastPreview: "No messages yet",
            hasPendingTicket: true,
          },
        ];
      }
      const proposal: UiProposal = {
        id: uid("prop-winback"),
        agent: "winback",
        kind: "reply",
        status: "pending",
        conversationId,
        triggerMessageId: null,
        parentProposalId: null,
        title: "Win back Elena",
        summary: "Lapsed regular: her usual with the welcome-back perk.",
        rationale: "Elena came every other Saturday for four months, then stopped. Offer her rye loaf, 10% off.",
        payload: {
          text: `Hi Elena, it's been a while. Want a rye loaf set aside for Saturday? 10% off to welcome you back. ${PAYMENT_LINK_TOKEN}\n— Larch & Rye`,
          orders: [{ items: [{ productId: "rye-loaf", qty: 1 }], pickupAt: FIXTURE_SAT_PICKUP, perk: "welcome_back_10" }],
        },
        evidence: [
          { label: "Cadence", value: "Every 14 days for four months", source: { table: "customers", id: elena.id } },
          { label: "Last order", value: "6 weeks ago (3× her usual gap)", source: { table: "orders", id: "elena-last" } },
          { label: "Usual", value: "1× rye loaf", source: { table: "orders", id: "elena-last" } },
        ],
        reads: [
          { table: "customers", id: elena.id },
          { table: "orders", id: "elena-1" },
          { table: "orders", id: "elena-2" },
          { table: "orders", id: "elena-last" },
        ],
        confidence: 0.81,
        riskFlags: [],
        shortCode: "W3",
        createdAt: new Date().toISOString(),
        decidedAt: null,
        executedAt: null,
        error: null,
        customerName: elena.name,
      };
      const steps = [
        { step: "context", ms: 64, summary: "30 customers with history, 1 overdue past 2.5x their own cadence", reads: [{ table: "customers", id: elena.id }] },
        { step: "plan", ms: 12, summary: "Elena: every 14 days for four months, last order 6 weeks ago; usual is a rye loaf", reads: [{ table: "orders", id: "elena-last" }] },
        { step: "draft", ms: 410, summary: "Personal note with her usual and the welcome-back 10%", reads: [] },
      ];
      for (const st of steps) {
        log({ actor: "agent:winback", type: "agent.step", subjectType: null, subjectId: null, data: { agent: "winback", flags: [], ...st } });
      }
      snap.proposals = [proposal, ...snap.proposals];
      log({ actor: "system", type: "winback.scanned", subjectType: null, subjectId: null, data: { candidates: 1 } });
      log({ actor: "agent:winback", type: "proposal.created", subjectType: "proposal", subjectId: proposal.id, data: { kind: "reply" } });
      commit("proposals", "events");
      return 1;
    },
    async receiveDelivery() {
      for (const ing of snap.ingredients.filter((i) => i.onOrder > 0)) {
        log({ actor: "system", type: "inventory.received", subjectType: "ingredient", subjectId: ing.id, data: { qty: ing.onOrder, simulated: true } });
      }
      snap.ingredients = snap.ingredients.map((i) => ({
        ...i,
        onHand: Math.round((i.onHand + i.onOrder) * 100) / 100,
        onOrder: 0,
      }));
      commit("ingredients", "events");
    },
    async simulateInbound(input) {
      const isOwner = input.handle === "owner";
      // Same keying as the server: a simulated texter gets their own conversation per handle.
      let conv = snap.conversations.find((c) =>
        isOwner ? c.role === "owner" : c.handle === input.handle && c.platform === "simulated",
      );
      if (!conv) {
        const known = snap.customers.find((c) => c.handle === input.handle);
        conv = {
          id: uid("conv"),
          customerId: known?.id ?? null,
          handle: input.handle,
          customerName: isOwner ? null : (known?.name ?? input.name ?? null),
          platform: "simulated",
          role: isOwner ? "owner" : "customer",
          lastMessageAt: new Date().toISOString(),
          lastPreview: input.text,
          hasPendingTicket: false,
        };
        snap.conversations = [conv, ...snap.conversations];
      }
      const message = addMessage(conv.id, "inbound", input.text);
      log({ actor: isOwner ? "owner" : "customer", type: "message.received", subjectType: "message", subjectId: message.id, data: { conversationId: conv.id, platform: "simulated" } });
      // A newer text supersedes the pending reply in this conversation, as on the server.
      const superseded = snap.proposals.filter((p) => p.conversationId === conv.id && p.status === "pending" && p.kind === "reply");
      setProposals(superseded.map((p) => p.id), { status: "superseded" });
      for (const p of superseded) log({ actor: "system", type: "proposal.superseded", subjectType: "proposal", subjectId: p.id, data: {} });
      commit("messages", "events", "proposals");

      // Like the server, answer as soon as the text is stored; the agents run afterwards.
      const conversation = conv;
      if (isOwner) {
        void sleep(300).then(() => ownerCommand(conversation.id, input.text));
        return;
      }
      void runAgents(conversation, message, input.text);
    },
  };

  async function runAgents(conv: DataSnapshot["conversations"][number], message: UiMessage, text: string) {
    const run = scriptFor(text, conv.customerName?.split(" ")[0] ?? null);
    for (const step of run.steps) {
      await sleep(STEP_MS);
      log({ actor: `agent:${step.agent}`, type: "agent.step", subjectType: "message", subjectId: message.id, data: { ...step } });
      commit("events");
    }

    const createdAt = new Date().toISOString();
    const ids = run.proposals.map(() => uid("prop"));
    const drafted: UiProposal[] = run.proposals.map((d, i) => ({
      ...d,
      id: ids[i],
      // The script lists a parent before its children, like the agents' parentIndex.
      parentProposalId: i > 0 && run.proposals[0].kind === "reply" && d.kind === "reorder" ? ids[0] : null,
      shortCode: i === 0 ? ids[0].slice(-2).toUpperCase() : null,
      createdAt,
      conversationId: conv.id,
      triggerMessageId: message.id,
      customerName: conv.customerName,
    }));
    snap.proposals = [...drafted, ...snap.proposals];
    for (const p of drafted) {
      log({ actor: `agent:${p.agent}`, type: "proposal.created", subjectType: "proposal", subjectId: p.id, data: { kind: p.kind } });
      const guard = p.riskFlags.filter((f) => f === "injection_suspected" || f === "off_policy" || f === "abusive");
      if (guard.length > 0) {
        log({ actor: "agent:guard", type: "guard.flagged", subjectType: "proposal", subjectId: p.id, data: { flags: guard } });
      }
    }
    commit("proposals", "events");
  }
}
