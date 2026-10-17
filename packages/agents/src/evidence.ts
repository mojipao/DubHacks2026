/**
 * Evidence chips: looked-up facts with the record they came from.
 *
 * The model never writes these. Every row is built here from values the pipeline
 * already read, which is what makes the numbers on a ticket checkable — a judge can
 * follow "Saturday capacity: 24 left" back to `products/butter-croissant`.
 */
import type { DayLoad, Evidence, IngredientNeed, OrderSummary, Product } from "@boh/shared";
import type { Usual } from "./usual.ts";
import type { PlannedDay } from "./ops.ts";
import { weekdayOf } from "./time.ts";

const titleCaseWeekday = (date: string, timezone: string): string => {
  const key = weekdayOf(date, timezone);
  return key.charAt(0).toUpperCase() + key.slice(1);
};

export function customerEvidence(
  customer: { id: string; name: string } | null,
  orderCount: number,
  firstOrderAt?: string,
): Evidence {
  if (!customer) {
    return { label: "Customer", value: "New number, no order history" };
  }
  const since = firstOrderAt
    ? `, regular since ${new Intl.DateTimeFormat("en-US", { month: "long" }).format(new Date(firstOrderAt))}`
    : "";
  const history = orderCount > 0 ? `${orderCount} past order${orderCount === 1 ? "" : "s"}` : "no past orders";
  return {
    label: "Customer",
    value: `${customer.name}, ${history}${since}`,
    source: { table: "customers", id: customer.id },
  };
}

export function usualEvidence(usual: Usual, catalog: Product[]): Evidence {
  const label = usual.items
    .map((i) => `${i.qty}x ${catalog.find((p) => p.id === i.productId)?.name ?? i.productId}`)
    .join(", ");
  return {
    label: "Usual order",
    value: `${label} (${usual.seenIn} of last ${usual.of})`,
    source: { table: "orders", id: usual.sourceOrderId },
  };
}

export function lastVisitEvidence(days: number, order: OrderSummary): Evidence {
  return {
    label: "Last visit",
    value: `${days} day${days === 1 ? "" : "s"} ago`,
    source: { table: "orders", id: order.id },
  };
}

export function capacityEvidence(localDate: string, load: DayLoad[], productId: string, timezone: string): Evidence | null {
  const row = load.find((l) => l.productId === productId);
  if (!row) return null;
  return {
    label: `${titleCaseWeekday(localDate, timezone)} capacity`,
    value: `${row.committed}/${row.capacity} committed, ${Math.max(0, row.capacity - row.committed)} left`,
    source: { table: "products", id: productId },
  };
}

export function stockEvidence(need: IngredientNeed): Evidence {
  const shortfall = need.shortfall > 0 ? `, plan needs ${need.need.toFixed(1)} ${need.unit}` : "";
  return {
    label: "Stock",
    value: `${need.name} ${need.onHand} ${need.unit} on hand${shortfall}`,
    source: { table: "ingredients", id: need.ingredientId },
  };
}

export function perkEvidence(daysSince: number, welcomeBackAfterDays: number): Evidence {
  return {
    label: "Perk",
    value: `Welcome back 10% eligible (${daysSince} days since last order, over ${welcomeBackAfterDays})`,
    source: { table: "business", id: "welcomeBackAfterDays" },
  };
}

export function planEvidence(days: PlannedDay[], catalog: Product[], timezone: string): Evidence {
  const value = days
    .map((day) => {
      const units = day.items
        .map((i) => `${i.qty}x ${catalog.find((p) => p.id === i.productId)?.name ?? i.productId}`)
        .join(", ");
      return `${titleCaseWeekday(day.localDate, timezone)}: ${units}`;
    })
    .join(" · ");
  return { label: "Plan", value };
}

export function unfulfilledEvidence(
  unfulfilled: { productId: string; qty: number }[],
  catalog: Product[],
): Evidence | null {
  if (unfulfilled.length === 0) return null;
  const value = unfulfilled
    .map((i) => `${i.qty}x ${catalog.find((p) => p.id === i.productId)?.name ?? i.productId}`)
    .join(", ");
  return { label: "Could not place", value };
}

export function allergyEvidence(customerId: string, notes: string): Evidence {
  return { label: "Allergy on file", value: notes, source: { table: "customers", id: customerId } };
}

export function priceEvidence(product: Product): Evidence {
  return {
    label: product.name,
    value: `$${(product.priceCents / 100).toFixed(2)}`,
    source: { table: "products", id: product.id },
  };
}
