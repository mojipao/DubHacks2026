import type { AgentDataPort, ConversationContext, CustomerProfile, Product, Tables } from "@boh/shared";
import { db } from "./db.ts";

function toCustomer(row: Tables<"customers">): CustomerProfile {
  return { id: row.id, name: row.name, handle: row.handle, notes: row.notes, isDemoPersona: row.is_demo_persona };
}

function notYet(method: string): never {
  throw new Error(`SupabaseDataPort.${method} is not implemented yet (lane 2 Phase 3)`);
}

/** Read-only view of the business for agents. Phase 2 covers what the stub needs; the rest lands in Phase 3. */
export const supabaseDataPort: AgentDataPort = {
  async getConversation(conversationId, limit = 20) {
    const { data: conv, error } = await db().from("conversations").select("*").eq("id", conversationId).single();
    if (error) throw new Error(`getConversation: ${error.message}`);
    const { data: rows, error: msgError } = await db()
      .from("messages")
      .select("id, direction, body, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (msgError) throw new Error(`getConversation messages: ${msgError.message}`);
    const messages: ConversationContext["messages"] = (rows ?? []).reverse().map((m) => ({
      id: m.id,
      direction: m.direction as "inbound" | "outbound",
      body: m.body,
      createdAt: m.created_at,
    }));
    return { id: conv.id, handle: conv.handle, customerId: conv.customer_id, messages };
  },

  async getCustomer(customerId) {
    const { data } = await db().from("customers").select("*").eq("id", customerId).maybeSingle();
    return data ? toCustomer(data) : null;
  },

  async getCustomerByHandle(handle) {
    const { data } = await db().from("customers").select("*").eq("handle", handle).maybeSingle();
    return data ? toCustomer(data) : null;
  },

  async getCatalog() {
    const { data, error } = await db().from("products").select("*").eq("active", true);
    if (error) throw new Error(`getCatalog: ${error.message}`);
    return (data ?? []).map(
      (p): Product => ({
        id: p.id,
        name: p.name,
        category: p.category as Product["category"],
        priceCents: p.price_cents,
        dailyCapacity: p.daily_capacity,
        aliases: p.aliases,
        active: p.active,
      }),
    );
  },

  async getPendingProposals(conversationId) {
    const { data, error } = await db()
      .from("proposals")
      .select("id, kind, summary")
      .eq("conversation_id", conversationId)
      .eq("status", "pending");
    if (error) throw new Error(`getPendingProposals: ${error.message}`);
    return (data ?? []).map((p) => ({ id: p.id, kind: p.kind as "reply" | "reorder", summary: p.summary }));
  },

  getOrderHistory: () => notYet("getOrderHistory"),
  getDayLoad: () => notYet("getDayLoad"),
  getIngredientNeeds: () => notYet("getIngredientNeeds"),
  getNextOpenDays: () => notYet("getNextOpenDays"),
  getRegularCadences: () => notYet("getRegularCadences"),
};
