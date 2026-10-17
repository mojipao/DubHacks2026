import type {
  Evidence,
  ProposalStatus,
  RecordRef,
  ReplyPayload,
  ReorderPayload,
  RiskFlag,
  Tables,
} from "@boh/shared";
import {
  approveProposal,
  markPaid,
  receiveDelivery,
  rejectProposal,
  retryProposal,
  runWinbackScan,
  simulateInbound,
} from "@/lib/actions";
import { PRODUCT_NAMES } from "@/lib/business";
import { computeFriction } from "@/lib/data/friction";
import type { DataSnapshot, DataSource } from "@/lib/data/source";
import type {
  ConnectionMode,
  UiConversation,
  UiCustomer,
  UiEvent,
  UiIngredient,
  UiMessage,
  UiOrder,
  UiProposal,
} from "@/lib/data/types";
import { addDaysKey, localDateKey, localMidnight } from "@/lib/format";
import { getSupabase, type BrowserDb } from "@/lib/supabase";

const FRICTION_TYPES = ["proposal.executed", "order.created", "proposal.created", "guard.flagged"];

function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data as T;
}

function toEvent(e: Tables<"events">): UiEvent {
  return {
    id: String(e.id),
    at: e.at,
    actor: e.actor,
    type: e.type,
    subjectType: e.subject_type,
    subjectId: e.subject_id,
    data: (e.data ?? {}) as Record<string, unknown>,
  };
}

function toProposal(p: Tables<"proposals">): UiProposal {
  return {
    id: p.id,
    agent: p.agent as UiProposal["agent"],
    kind: p.kind as UiProposal["kind"],
    status: p.status as ProposalStatus,
    conversationId: p.conversation_id,
    triggerMessageId: p.trigger_message_id,
    parentProposalId: p.parent_proposal_id,
    title: p.title,
    summary: p.summary,
    rationale: p.rationale ?? "",
    payload: p.payload as unknown as ReplyPayload | ReorderPayload,
    evidence: (p.evidence ?? []) as unknown as Evidence[],
    reads: (p.reads ?? []) as unknown as RecordRef[],
    confidence: Number(p.confidence ?? 0),
    riskFlags: (p.risk_flags ?? []) as RiskFlag[],
    shortCode: p.short_code,
    createdAt: p.created_at,
    decidedAt: p.decided_at,
    executedAt: p.executed_at,
    error: p.error,
    customerName: null,
  };
}

async function fetchSnapshot(sb: BrowserDb): Promise<Omit<DataSnapshot, "connection">> {
  const todayKey = localDateKey(new Date());
  const todayStart = localMidnight(todayKey).toISOString();
  // Pickups board looks a week ahead; history orders before today stay out of the browser.
  const horizon = localMidnight(addDaysKey(todayKey, 8)).toISOString();

  const lastReset = await sb
    .from("events")
    .select("at")
    .eq("type", "demo.reset")
    .order("at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const since = lastReset.data?.at ?? "1970-01-01T00:00:00Z";

  const [
    customersRes,
    conversationsRes,
    messagesRes,
    proposalsRes,
    upcomingRes,
    paidTodayRes,
    ingredientsRes,
    eventsRes,
    frictionRes,
  ] = await Promise.all([
    sb.from("customers").select("*"),
    sb.from("conversations").select("*").order("last_message_at", { ascending: false }).limit(60),
    sb.from("messages").select("*").order("created_at", { ascending: false }).limit(300),
    sb.from("proposals").select("*").order("created_at", { ascending: false }).limit(100),
    sb
      .from("orders")
      .select("*")
      .gte("pickup_at", todayStart)
      .lt("pickup_at", horizon)
      .order("pickup_at", { ascending: true })
      .limit(200),
    sb.from("orders").select("*").gte("paid_at", todayStart).limit(200),
    sb.from("ingredients").select("*").order("name"),
    sb
      .from("events")
      .select("*")
      .gte("at", since)
      .order("at", { ascending: false })
      .limit(500),
    sb
      .from("events")
      .select("type, subject_id, data")
      .in("type", FRICTION_TYPES)
      .gte("at", since)
      .limit(2000),
  ]);

  const customers = must(customersRes, "customers").map(
    (c): UiCustomer => ({
      id: c.id,
      name: c.name,
      handle: c.handle,
      isDemoPersona: c.is_demo_persona,
    }),
  );
  const customerById = new Map(customers.map((c) => [c.id, c]));

  const rawConversations = must(conversationsRes, "conversations");
  const conversationById = new Map(rawConversations.map((c) => [c.id, c]));

  const events = must(eventsRes, "events").map(toEvent);

  const approvedViaText = new Set(
    events
      .filter((e) => e.type === "proposal.approved" && e.data.via === "imessage")
      .map((e) => e.subjectId),
  );
  const guardSummaryByMessage = new Map<string, string>();
  for (const e of events) {
    if (e.type !== "agent.step" || e.data.step !== "guard" || !e.subjectId) continue;
    // Events are newest first; keep the latest guard step per trigger message.
    if (!guardSummaryByMessage.has(e.subjectId) && typeof e.data.summary === "string") {
      guardSummaryByMessage.set(e.subjectId, e.data.summary);
    }
  }

  const proposals = must(proposalsRes, "proposals").map((row) => {
    const p = toProposal(row);
    const conv = p.conversationId ? conversationById.get(p.conversationId) : undefined;
    p.customerName = conv?.customer_id ? (customerById.get(conv.customer_id)?.name ?? null) : null;
    if (approvedViaText.has(p.id)) p.approvedVia = "imessage";
    if (p.triggerMessageId) p.guardSummary = guardSummaryByMessage.get(p.triggerMessageId);
    return p;
  });

  const messages = must(messagesRes, "messages")
    .map(
      (m): UiMessage => ({
        id: m.id,
        conversationId: m.conversation_id,
        direction: m.direction as UiMessage["direction"],
        body: m.body,
        status: m.status,
        createdAt: m.created_at,
        approvedByOwner: m.direction === "outbound",
      }),
    )
    .reverse();

  const latestByConversation = new Map<string, UiMessage>();
  for (const m of messages) latestByConversation.set(m.conversationId, m);

  const conversations = rawConversations.map((c): UiConversation => {
    const customer = c.customer_id ? customerById.get(c.customer_id) : undefined;
    return {
      id: c.id,
      customerId: c.customer_id,
      handle: c.handle,
      customerName: customer?.name ?? null,
      platform: c.platform as UiConversation["platform"],
      role: c.role as UiConversation["role"],
      lastMessageAt: c.last_message_at,
      lastPreview: latestByConversation.get(c.id)?.body.slice(0, 80) ?? "",
      hasPendingTicket: proposals.some((p) => p.conversationId === c.id && p.status === "pending"),
    };
  });

  const orderRows = new Map<string, Tables<"orders">>();
  for (const o of [...must(upcomingRes, "orders"), ...must(paidTodayRes, "paid orders")]) {
    orderRows.set(o.id, o);
  }
  const orderIds = [...orderRows.keys()];
  const items =
    orderIds.length > 0
      ? must(
          await sb.from("order_items").select("order_id, product_id, qty").in("order_id", orderIds),
          "order_items",
        )
      : [];
  const itemsByOrder = new Map<string, UiOrder["items"]>();
  for (const i of items) {
    const list = itemsByOrder.get(i.order_id) ?? [];
    list.push({ productId: i.product_id, name: PRODUCT_NAMES[i.product_id] ?? i.product_id, qty: i.qty });
    itemsByOrder.set(i.order_id, list);
  }

  const orders = [...orderRows.values()]
    .sort((a, b) => Date.parse(a.pickup_at) - Date.parse(b.pickup_at))
    .map(
      (o): UiOrder => ({
        id: o.id,
        customerId: o.customer_id,
        customerName: o.customer_id ? (customerById.get(o.customer_id)?.name ?? null) : null,
        status: o.status as UiOrder["status"],
        pickupAt: o.pickup_at,
        totalCents: o.total_cents,
        discountCents: o.discount_cents,
        source: o.source as UiOrder["source"],
        createdAt: o.created_at,
        paidAt: o.paid_at,
        items: itemsByOrder.get(o.id) ?? [],
      }),
    );

  const ingredients = must(ingredientsRes, "ingredients").map(
    (i): UiIngredient => ({
      id: i.id,
      name: i.name,
      unit: i.unit,
      onHand: Number(i.on_hand),
      onOrder: Number(i.on_order),
      reorderPoint: Number(i.reorder_point),
    }),
  );

  // Executed proposals can be older than the 100 we loaded; fetch the missing ones so minutes saved stays exact.
  const frictionEvents = must(frictionRes, "friction events").map((e) => ({
    type: e.type,
    subjectId: e.subject_id,
    data: (e.data ?? {}) as Record<string, unknown>,
  }));
  const proposalById = new Map<string, Pick<UiProposal, "kind" | "payload" | "riskFlags">>(
    proposals.map((p) => [p.id, p]),
  );
  const missing = [
    ...new Set(
      frictionEvents
        .filter((e) => e.type === "proposal.executed" && e.subjectId && !proposalById.has(e.subjectId))
        .map((e) => e.subjectId as string),
    ),
  ];
  if (missing.length > 0) {
    const extra = must(
      await sb.from("proposals").select("id, kind, payload, risk_flags").in("id", missing),
      "executed proposals",
    );
    for (const p of extra) {
      proposalById.set(p.id, {
        kind: p.kind as UiProposal["kind"],
        payload: p.payload as unknown as ReplyPayload | ReorderPayload,
        riskFlags: (p.risk_flags ?? []) as RiskFlag[],
      });
    }
  }

  return {
    customers,
    conversations,
    messages,
    proposals,
    orders,
    ingredients,
    events,
    friction: computeFriction(frictionEvents, proposalById),
  };
}

const REALTIME_TABLES = ["conversations", "messages", "proposals", "orders", "ingredients", "events"] as const;
const SUBSCRIBE_TIMEOUT_MS = 5000;
const POLL_MS = 3000;
/** A single agent run writes a burst of rows; one refetch covers the whole burst. */
const COALESCE_MS = 150;

export function createLiveSource(): DataSource {
  const listeners = new Set<(patch: Partial<DataSnapshot>) => void>();
  let connection: ConnectionMode = "polling";
  let inFlight = false;
  let dirty = false;
  let coalesceTimer: ReturnType<typeof setTimeout> | null = null;

  const emit = (patch: Partial<DataSnapshot>) => {
    for (const l of listeners) l(patch);
  };

  const refresh = async () => {
    const sb = getSupabase();
    if (!sb) return;
    if (inFlight) {
      dirty = true;
      return;
    }
    inFlight = true;
    try {
      const snap = await fetchSnapshot(sb);
      emit({ ...snap, connection });
    } catch (err) {
      console.error("Live refresh failed", err);
    } finally {
      inFlight = false;
      if (dirty) {
        dirty = false;
        void refresh();
      }
    }
  };

  const scheduleRefresh = () => {
    if (coalesceTimer) return;
    coalesceTimer = setTimeout(() => {
      coalesceTimer = null;
      void refresh();
    }, COALESCE_MS);
  };

  const setConnection = (next: ConnectionMode) => {
    if (connection === next) return;
    connection = next;
    emit({ connection });
  };

  return {
    mode: "realtime",
    async load() {
      const sb = getSupabase();
      if (!sb) {
        throw new Error(
          "Live mode needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in apps/web/.env.local",
        );
      }
      return { ...(await fetchSnapshot(sb)), connection };
    },
    subscribe(onChange) {
      listeners.add(onChange);
      const sb = getSupabase();
      if (!sb) return () => void listeners.delete(onChange);

      let pollTimer: ReturnType<typeof setInterval> | null = null;
      const startPolling = () => {
        setConnection("polling");
        if (!pollTimer) pollTimer = setInterval(() => void refresh(), POLL_MS);
      };
      const stopPolling = () => {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = null;
      };

      const channel = sb.channel("boh-control-room");
      for (const table of REALTIME_TABLES) {
        channel.on("postgres_changes", { event: "*", schema: "public", table }, scheduleRefresh);
      }

      const timeout = setTimeout(() => {
        if (connection !== "realtime") startPolling();
      }, SUBSCRIBE_TIMEOUT_MS);

      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timeout);
          stopPolling();
          setConnection("realtime");
          // Catch anything written between the first load and the subscription.
          scheduleRefresh();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          startPolling();
        }
      });

      return () => {
        listeners.delete(onChange);
        clearTimeout(timeout);
        stopPolling();
        if (coalesceTimer) clearTimeout(coalesceTimer);
        void sb.removeChannel(channel);
      };
    },
    getTrace() {
      // Live traces are derived from the store's agent.step events.
      return [];
    },
    async approve(id, opts) {
      await approveProposal(id, opts);
      scheduleRefresh();
    },
    async reject(id, opts) {
      await rejectProposal(id, opts);
      scheduleRefresh();
    },
    async retry(id) {
      await retryProposal(id);
      scheduleRefresh();
    },
    async simulateInbound(input) {
      await simulateInbound(input);
      scheduleRefresh();
    },
    async markPaid(orderId) {
      await markPaid(orderId);
      scheduleRefresh();
    },
    async winbackScan() {
      const { created } = await runWinbackScan();
      scheduleRefresh();
      return created;
    },
    async receiveDelivery() {
      await receiveDelivery();
      scheduleRefresh();
    },
  };
}
