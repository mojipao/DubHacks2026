/**
 * "The usual": the most frequent exact basket in a customer's recent orders.
 *
 * Deliberately exact-match rather than per-item frequency. A customer who orders
 * two pistachio maamoul and a latte nine times out of twelve has a usual; someone
 * whose items overlap loosely does not, and guessing one for them is how an agent
 * puts words in the shop's mouth. When there is no clear usual, the caller flags
 * `needs_clarification` and asks.
 */
import type { OrderLine, OrderSummary } from "@boh/shared";

export interface Usual {
  items: OrderLine[];
  /** How many of the orders considered were exactly this basket. */
  seenIn: number;
  /** How many orders were considered. */
  of: number;
  /** The most recent order with this basket, for the evidence chip's source. */
  sourceOrderId: string;
  /** Human-readable, built by the caller from the catalog: "2x Pistachio maamoul, 1x Adeni chai". */
  label?: string;
}

const signature = (items: { productId: string; qty: number }[]): string =>
  items
    .map((i) => `${i.productId}x${i.qty}`)
    .sort()
    .join("|");

/**
 * @param history newest first, as `getOrderHistory` returns it
 * @param consider how many recent orders to weigh; 12 matches the evidence chip
 * @param minTimes a basket seen fewer times than this is not a habit
 */
export function computeUsual(history: OrderSummary[], consider = 12, minTimes = 3): Usual | null {
  const recent = history
    .filter((o) => o.status === "paid" || o.status === "fulfilled")
    .slice(0, consider);
  if (recent.length === 0) return null;

  const groups = new Map<string, { orders: OrderSummary[]; items: OrderLine[] }>();
  for (const order of recent) {
    if (order.items.length === 0) continue;
    const key = signature(order.items);
    const group = groups.get(key);
    if (group) {
      group.orders.push(order);
    } else {
      groups.set(key, {
        orders: [order],
        items: order.items.map((i) => ({ productId: i.productId, qty: i.qty })),
      });
    }
  }

  let best: { orders: OrderSummary[]; items: OrderLine[] } | undefined;
  for (const group of groups.values()) {
    if (!best || group.orders.length > best.orders.length) best = group;
  }
  if (!best || best.orders.length < minTimes) return null;

  // Ties go to nobody: two equally common baskets means there is no single usual.
  const tied = [...groups.values()].filter((g) => g.orders.length === best.orders.length);
  if (tied.length > 1) return null;

  const newest = best.orders.reduce((a, b) => (a.createdAt >= b.createdAt ? a : b));
  return { items: best.items, seenIn: best.orders.length, of: recent.length, sourceOrderId: newest.id };
}

/** Days since the customer's most recent paid or fulfilled order, or null if they have none. */
export function daysSinceLastOrder(history: OrderSummary[], now: Date): number | null {
  const paid = history.filter((o) => o.status === "paid" || o.status === "fulfilled");
  if (paid.length === 0) return null;
  const newest = paid.reduce((a, b) => (a.createdAt >= b.createdAt ? a : b));
  return Math.floor((now.getTime() - new Date(newest.createdAt).getTime()) / 86_400_000);
}
