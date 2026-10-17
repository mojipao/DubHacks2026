import type { Evidence, RecordRef, ReplyPayload, ReorderPayload, RiskFlag } from "@boh/shared";
import { BUSINESS } from "@/lib/business";
import type { DataSnapshot, DataSource } from "@/lib/data/source";
import type {
  TraceStep,
  UiConversation,
  UiEvent,
  UiIngredient,
  UiMessage,
  UiOrder,
  UiProposal,
} from "@/lib/data/types";
import { getSupabase } from "@/lib/supabase";

async function fetchSnapshot(): Promise<DataSnapshot> {
  const sb = getSupabase();
  if (!sb) {
    throw new Error("Supabase not configured");
  }

  const [
    conversationsRes,
    messagesRes,
    proposalsRes,
    ordersRes,
    ingredientsRes,
    eventsRes,
    customersRes,
  ] = await Promise.all([
    sb.from("conversations").select("*").order("last_message_at", { ascending: false }).limit(50),
    sb.from("messages").select("*").order("created_at", { ascending: false }).limit(200),
    sb.from("proposals").select("*").order("created_at", { ascending: false }).limit(80),
    sb.from("orders").select("*").order("pickup_at", { ascending: true }).limit(80),
    sb.from("ingredients").select("*"),
    sb.from("events").select("*").order("at", { ascending: false }).limit(80),
    sb.from("customers").select("id,name,handle"),
  ]);

  const customers = new Map(
    (customersRes.data ?? []).map((c) => [c.id as string, c as { id: string; name: string; handle: string | null }]),
  );

  const messages = (messagesRes.data ?? []).map(
    (m): UiMessage => ({
      id: m.id,
      conversationId: m.conversation_id,
      direction: m.direction,
      body: m.body,
      status: m.status,
      createdAt: m.created_at,
      approvedByOwner: m.direction === "outbound",
    }),
  );

  const messagesByConv = new Map<string, UiMessage[]>();
  for (const m of messages) {
    const list = messagesByConv.get(m.conversationId) ?? [];
    list.push(m);
    messagesByConv.set(m.conversationId, list);
  }

  const proposals = (proposalsRes.data ?? []).map((p): UiProposal => {
    const conv = (conversationsRes.data ?? []).find((c) => c.id === p.conversation_id);
    const customer = conv?.customer_id ? customers.get(conv.customer_id) : null;
    return {
      id: p.id,
      agent: p.agent,
      kind: p.kind,
      status: p.status,
      conversationId: p.conversation_id,
      triggerMessageId: p.trigger_message_id,
      parentProposalId: p.parent_proposal_id,
      title: p.title,
      summary: p.summary,
      rationale: p.rationale ?? "",
      payload: p.payload as ReplyPayload | ReorderPayload,
      evidence: (p.evidence ?? []) as Evidence[],
      reads: (p.reads ?? []) as RecordRef[],
      confidence: Number(p.confidence ?? 0),
      riskFlags: (p.risk_flags ?? []) as RiskFlag[],
      shortCode: p.short_code,
      createdAt: p.created_at,
      decidedAt: p.decided_at,
      executedAt: p.executed_at,
      error: p.error,
      customerName: customer?.name ?? null,
      guardSummary: undefined,
    };
  });

  const conversations = (conversationsRes.data ?? []).map((c): UiConversation => {
    const customer = c.customer_id ? customers.get(c.customer_id) : null;
    const convMessages = messagesByConv.get(c.id) ?? [];
    const latest = convMessages[0];
    return {
      id: c.id,
      customerId: c.customer_id,
      handle: c.handle,
      customerName: customer?.name ?? null,
      platform: c.platform,
      role: c.role,
      lastMessageAt: c.last_message_at,
      lastPreview: latest?.body.slice(0, 80) ?? "",
      hasPendingTicket: proposals.some(
        (p) => p.conversationId === c.id && p.status === "pending",
      ),
    };
  });

  const orderIds = (ordersRes.data ?? []).map((o) => o.id as string);
  const itemsRes =
    orderIds.length > 0
      ? await sb.from("order_items").select("order_id,product_id,qty,unit_price_cents").in("order_id", orderIds)
      : { data: [] };
  const productsRes = await sb.from("products").select("id,name");
  const productNames = new Map(
    (productsRes.data ?? []).map((p) => [p.id as string, p.name as string]),
  );

  const orders = (ordersRes.data ?? []).map((o): UiOrder => {
    const customer = o.customer_id ? customers.get(o.customer_id) : null;
    const items = (itemsRes.data ?? [])
      .filter((i) => i.order_id === o.id)
      .map((i) => ({
        productId: i.product_id as string,
        name: productNames.get(i.product_id as string) ?? (i.product_id as string),
        qty: i.qty as number,
      }));
    return {
      id: o.id,
      customerId: o.customer_id,
      customerName: customer?.name ?? null,
      status: o.status,
      pickupAt: o.pickup_at,
      totalCents: o.total_cents,
      discountCents: o.discount_cents,
      source: o.source,
      items,
    };
  });

  const ingredients = (ingredientsRes.data ?? []).map(
    (i): UiIngredient => ({
      id: i.id,
      name: i.name,
      unit: i.unit,
      onHand: Number(i.on_hand),
      onOrder: Number(i.on_order),
      reorderPoint: Number(i.reorder_point),
    }),
  );

  const events = (eventsRes.data ?? []).map(
    (e): UiEvent => ({
      id: String(e.id),
      at: e.at,
      actor: e.actor,
      type: e.type,
      subjectType: e.subject_type,
      subjectId: e.subject_id,
      data: (e.data ?? {}) as Record<string, unknown>,
    }),
  );

  const friction = computeFriction(events, proposals);

  return {
    conversations,
    messages: messages.reverse(),
    proposals,
    orders,
    ingredients,
    events,
    friction,
    connection: "realtime",
  };
}

function computeFriction(
  events: UiEvent[],
  proposals: UiProposal[],
): DataSnapshot["friction"] {
  const proposalById = new Map(proposals.map((p) => [p.id, p]));
  let messagesHandled = 0;
  let ordersCreated = 0;
  let reordersDrafted = 0;
  let guardCatches = 0;
  let ownerMinutesSaved = 0;

  for (const e of events) {
    if (e.type === "order.created") ordersCreated += 1;
    if (e.type === "guard.flagged") {
      guardCatches += 1;
      ownerMinutesSaved += BUSINESS.minutesSaved.guardCatch;
    }
    if (e.type === "proposal.created") {
      const p = e.subjectId ? proposalById.get(e.subjectId) : null;
      if (p?.kind === "reorder") reordersDrafted += 1;
    }
    if (e.type === "proposal.executed") {
      const p = e.subjectId ? proposalById.get(e.subjectId) : null;
      if (!p) continue;
      if (p.kind === "reply") {
        messagesHandled += 1;
        const orders = (p.payload as ReplyPayload).orders ?? [];
        if (orders.length >= 2 || p.riskFlags.includes("counteroffer")) {
          ownerMinutesSaved += BUSINESS.minutesSaved.counteroffer;
        } else {
          ownerMinutesSaved += BUSINESS.minutesSaved.reply;
          ownerMinutesSaved += orders.length * BUSINESS.minutesSaved.order;
        }
      } else {
        ownerMinutesSaved += BUSINESS.minutesSaved.reorder;
      }
    }
  }

  return {
    messagesHandled,
    ordersCreated,
    reordersDrafted,
    guardCatches,
    ownerMinutesSaved,
  };
}

export function createLiveSource(): DataSource {
  const listeners = new Set<(patch: Partial<DataSnapshot>) => void>();
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let channelReady = false;

  const refresh = async (connection: DataSnapshot["connection"]) => {
    const snap = await fetchSnapshot();
    snap.connection = connection;
    for (const l of listeners) l(snap);
  };

  return {
    mode: "realtime",
    async load() {
      return fetchSnapshot();
    },
    subscribe(onChange) {
      listeners.add(onChange);
      const sb = getSupabase();
      if (!sb) {
        return () => listeners.delete(onChange);
      }

      const tables = [
        "conversations",
        "messages",
        "proposals",
        "orders",
        "ingredients",
        "events",
      ] as const;

      const channel = sb.channel("boh-control-room");
      for (const table of tables) {
        channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          () => {
            void refresh(channelReady ? "realtime" : "polling");
          },
        );
      }

      const timeout = setTimeout(() => {
        if (!channelReady) {
          void refresh("polling");
          pollTimer = setInterval(() => void refresh("polling"), 3000);
        }
      }, 5000);

      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channelReady = true;
          clearTimeout(timeout);
          if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
          }
          void refresh("realtime");
        }
      });

      return () => {
        listeners.delete(onChange);
        clearTimeout(timeout);
        if (pollTimer) clearInterval(pollTimer);
        void sb.removeChannel(channel);
      };
    },
    getTrace(triggerMessageId) {
      // Populated from events in the store; live source returns empty and store derives.
      void triggerMessageId;
      return [] as TraceStep[];
    },
    async approve(id, opts) {
      const res = await fetch(`/api/proposals/${id}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(opts ?? {}),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw Object.assign(new Error(body.error ?? "Approve failed"), {
          status: res.status,
        });
      }
    },
    async reject(id, opts) {
      const res = await fetch(`/api/proposals/${id}/reject`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(opts ?? {}),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw Object.assign(new Error(body.error ?? "Reject failed"), {
          status: res.status,
        });
      }
    },
    async simulateInbound(input) {
      const res = await fetch("/api/dev/inbound", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Inbound failed");
      }
    },
  };
}
