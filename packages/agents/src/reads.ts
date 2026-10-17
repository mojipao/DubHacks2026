/**
 * Wraps an `AgentDataPort` so every lookup records the records it touched.
 *
 * A ticket claims "read 14 orders · 1 customer · Saturday capacity". That claim has to
 * come from the lookups themselves, not from a hand-maintained list that drifts the
 * first time someone adds a step to the pipeline. The draft's `reads` is the union of
 * everything this recorder saw.
 */
import type { AgentDataPort, OrderLine, RecordRef } from "@boh/shared";

export interface RecordingPort extends AgentDataPort {
  /** Every record read so far, de-duplicated, in the order first seen. */
  reads(): RecordRef[];
  /** Counts by table, for the ticket face. */
  readCounts(): Record<string, number>;
}

export function recordReads(port: AgentDataPort): RecordingPort {
  const seen = new Map<string, RecordRef>();

  const note = (table: string, id: string | null | undefined): void => {
    if (!id) return;
    const key = `${table}/${id}`;
    if (!seen.has(key)) seen.set(key, { table, id });
  };

  return {
    async getConversation(conversationId: string, limit?: number) {
      const conversation = await port.getConversation(conversationId, limit);
      note("conversations", conversation.id);
      for (const message of conversation.messages) note("messages", message.id);
      return conversation;
    },

    async getCustomer(customerId: string) {
      const customer = await port.getCustomer(customerId);
      note("customers", customer?.id);
      return customer;
    },

    async getCustomerByHandle(handle: string) {
      const customer = await port.getCustomerByHandle(handle);
      note("customers", customer?.id);
      return customer;
    },

    async getOrderHistory(customerId: string, limit?: number) {
      const orders = await port.getOrderHistory(customerId, limit);
      for (const order of orders) note("orders", order.id);
      return orders;
    },

    async getCatalog() {
      const catalog = await port.getCatalog();
      for (const item of catalog) note("products", item.id);
      return catalog;
    },

    async getDayLoad(localDate: string) {
      const load = await port.getDayLoad(localDate);
      // The day is part of what was read, so the ticket can say which date it checked.
      note("day_load", localDate);
      for (const row of load) note("products", row.productId);
      return load;
    },

    async getIngredientNeeds(items: OrderLine[], localDate: string) {
      const needs = await port.getIngredientNeeds(items, localDate);
      for (const need of needs) note("ingredients", need.ingredientId);
      return needs;
    },

    async getPendingProposals(conversationId: string) {
      const pending = await port.getPendingProposals(conversationId);
      for (const proposal of pending) note("proposals", proposal.id);
      return pending;
    },

    async getNextOpenDays(localDate: string, count: number) {
      const days = await port.getNextOpenDays(localDate, count);
      for (const day of days) {
        note("day_load", day.localDate);
        for (const row of day.load) note("products", row.productId);
      }
      return days;
    },

    async getRegularCadences() {
      const cadences = await port.getRegularCadences();
      for (const cadence of cadences) note("customers", cadence.customerId);
      return cadences;
    },

    reads() {
      return [...seen.values()];
    },

    readCounts() {
      const counts: Record<string, number> = {};
      for (const ref of seen.values()) counts[ref.table] = (counts[ref.table] ?? 0) + 1;
      return counts;
    },
  };
}
