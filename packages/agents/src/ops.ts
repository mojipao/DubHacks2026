/**
 * Ops: capacity, stock, and the counteroffer.
 *
 * All deterministic. No model runs in this file, which is the point — "we can do 24
 * Saturday and 24 Sunday, and that needs 3 kg more ghee" is arithmetic over the
 * shop's own records, and a judge can check it against the ticket's evidence.
 */
import type {
  AgentDataPort,
  BusinessProfile,
  DayLoad,
  IngredientNeed,
  OrderLine,
  ReorderPayload,
  RiskFlag,
} from "@boh/shared";
import { addDays, isOpenOn, isoWithOffset, weekdayOf } from "./time.ts";

export interface PlannedDay {
  localDate: string;
  /** "YYYY-MM-DDTHH:mm" in the business timezone. */
  pickupLocal: string;
  items: OrderLine[];
}

export interface FulfillmentPlan {
  days: PlannedDay[];
  /** Requested units that no open day in range could absorb. */
  unfulfilled: OrderLine[];
  /** True when the requested day could not take the whole order. */
  capacitySplit: boolean;
  /** Ingredient needs for the whole plan, aggregated against one stock pool. */
  needs: IngredientNeed[];
  /** The capacity rows each planned day was measured against, keyed by local date. */
  loads: Record<string, DayLoad[]>;
  flags: RiskFlag[];
  /** One line with the real numbers, for `ctx.trace` and the ticket. */
  summary: string;
}

const remainingOn = (load: DayLoad[], productId: string): number => {
  const row = load.find((l) => l.productId === productId);
  return row ? Math.max(0, row.capacity - row.committed) : 0;
};

/** Keeps the pickup time if the shop is open then, otherwise opens-at on that day. */
function pickupTimeFor(localDate: string, requestedTime: string, business: BusinessProfile): string {
  const hours = business.hours[weekdayOf(localDate, business.timezone)];
  if (!hours) return requestedTime;
  if (requestedTime >= hours.open && requestedTime <= hours.close) return requestedTime;
  return hours.open;
}

/**
 * Splits a request across open days when the requested day cannot hold it.
 *
 * Fills the requested day to its remaining capacity first, then walks the next open
 * days. Anything that still does not fit comes back in `unfulfilled` so the reply can
 * say what it could not do instead of silently shrinking the order.
 */
export async function planFulfillment(
  requested: OrderLine[],
  pickupLocal: string,
  port: AgentDataPort,
  business: BusinessProfile,
  lookAheadDays = 3,
): Promise<FulfillmentPlan> {
  const [requestedDate = "", requestedTime = "09:00"] = pickupLocal.split("T");
  const flags: RiskFlag[] = [];

  const requestedLoad = await port.getDayLoad(requestedDate);
  const laterDays = await port.getNextOpenDays(requestedDate, lookAheadDays);

  // Capacity per candidate day, requested day first.
  const candidates: { localDate: string; load: DayLoad[] }[] = [
    { localDate: requestedDate, load: requestedLoad },
    ...laterDays.map((d) => ({ localDate: d.localDate, load: d.load })),
  ];

  const outstanding = new Map(requested.map((i) => [i.productId, i.qty]));
  const perDay = new Map<string, OrderLine[]>();

  for (const candidate of candidates) {
    if ([...outstanding.values()].every((q) => q <= 0)) break;
    for (const [productId, wanted] of outstanding) {
      if (wanted <= 0) continue;
      const canTake = Math.min(wanted, remainingOn(candidate.load, productId));
      if (canTake <= 0) continue;
      const lines = perDay.get(candidate.localDate) ?? [];
      lines.push({ productId, qty: canTake });
      perDay.set(candidate.localDate, lines);
      outstanding.set(productId, wanted - canTake);
    }
  }

  const unfulfilled: OrderLine[] = [...outstanding]
    .filter(([, qty]) => qty > 0)
    .map(([productId, qty]) => ({ productId, qty }));

  // A split counteroffer is capped at two orders by ReplyPayload, so the shape of the
  // plan is: the requested day, plus at most one more. Anything past that is unfulfilled.
  const ordered = [...perDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  const kept = ordered.slice(0, 2);
  for (const [, lines] of ordered.slice(2)) {
    for (const line of lines) {
      const existing = unfulfilled.find((u) => u.productId === line.productId);
      if (existing) existing.qty += line.qty;
      else unfulfilled.push({ ...line });
    }
  }

  const days: PlannedDay[] = kept.map(([localDate, items]) => ({
    localDate,
    pickupLocal: `${localDate}T${pickupTimeFor(localDate, requestedTime, business)}`,
    items,
  }));

  const capacitySplit = days.length > 1 || unfulfilled.length > 0;
  if (capacitySplit) flags.push("capacity_shortfall", "counteroffer");

  // One ingredient pool, many days. Each day's `need` already includes that day's
  // committed orders, so summing days is right; `onHand` is the same stock for all of
  // them, so it must not be summed.
  const needs = await aggregateNeeds(days, port);
  if (needs.some((n) => n.shortfall > 0)) flags.push("ingredient_shortfall");

  const loads: Record<string, DayLoad[]> = {};
  for (const candidate of candidates) loads[candidate.localDate] = candidate.load;

  return {
    days,
    unfulfilled,
    capacitySplit,
    needs,
    loads,
    flags,
    summary: describe(days, unfulfilled, needs, business),
  };
}

/**
 * Ingredient needs for a whole multi-day plan, measured against one stock pool.
 *
 * `getIngredientNeeds(items, date)` answers for one day, counting that day's committed
 * orders. Summing the per-day `need` is correct because each day's committed load is
 * distinct, but `onHand` and `onOrder` describe the same shelf and are taken once.
 */
export async function aggregateNeeds(days: PlannedDay[], port: AgentDataPort): Promise<IngredientNeed[]> {
  const totals = new Map<string, IngredientNeed>();

  for (const day of days) {
    for (const need of await port.getIngredientNeeds(day.items, day.localDate)) {
      const running = totals.get(need.ingredientId);
      if (running) running.need += need.need;
      else totals.set(need.ingredientId, { ...need });
    }
  }

  for (const need of totals.values()) {
    need.shortfall = Math.max(0, need.need - need.onHand - need.onOrder);
  }
  return [...totals.values()];
}

/** The last open day strictly before a pickup date: when a delivery has to land. */
export function lastOpenDayBefore(localDate: string, business: BusinessProfile): string {
  for (let i = 1; i <= 14; i++) {
    const candidate = addDays(localDate, -i);
    if (isOpenOn(candidate, business)) return candidate;
  }
  return addDays(localDate, -1);
}

export interface PlannedReorder {
  payload: ReorderPayload;
  title: string;
  summary: string;
  rationale: string;
  totalCents: number;
  ingredientIds: string[];
}

/**
 * One reorder per supplier covering every shortfall, topped back up to the reorder
 * point and rounded to a whole supplier unit, due the last open day before the
 * earliest pickup it affects.
 */
export function planReorder(
  needs: IngredientNeed[],
  business: BusinessProfile,
  earliestPickupLocalDate: string,
): PlannedReorder[] {
  const short = needs.filter((n) => n.shortfall > 0);
  if (short.length === 0) return [];

  const neededByDate = lastOpenDayBefore(earliestPickupLocalDate, business);
  const openAt = business.hours[weekdayOf(neededByDate, business.timezone)]?.open ?? "08:00";

  const bySupplier = new Map<string, IngredientNeed[]>();
  for (const need of short) {
    bySupplier.set(need.supplier, [...(bySupplier.get(need.supplier) ?? []), need]);
  }

  return [...bySupplier].map(([supplier, items]) => {
    const lines = items.map((need) => {
      const leftAfterOrder = Math.max(0, need.onHand + need.onOrder - need.need);
      // Cover the gap and come back up to the reorder point, so this does not
      // immediately trigger another reorder tomorrow.
      const qty = Math.ceil(need.shortfall + Math.max(0, (need.reorderPoint ?? 0) - leftAfterOrder));
      return { ingredientId: need.ingredientId, qty, name: need.name, unit: need.unit };
    });

    const totalCents = lines.reduce(
      (sum, l) => sum + l.qty * (items.find((i) => i.ingredientId === l.ingredientId)?.unitCostCents ?? 0),
      0,
    );
    const spoken = lines.map((l) => `${l.qty} ${l.unit} ${l.name.toLowerCase()}`).join(", ");

    return {
      payload: {
        supplier,
        lines: lines.map((l) => ({ ingredientId: l.ingredientId, qty: l.qty })),
        // A full instant with an offset. `ReorderPayload.neededBy` is IsoDateTime
        // (offset required), so a bare "2026-10-23T07:00" makes the server's
        // ProposalDraft.parse reject the whole reorder draft — and Jun's counteroffer
        // then arrives with no ghee reorder, which is the demo's second beat.
        neededBy: isoWithOffset(`${neededByDate}T${openAt}`, business.timezone),
      },
      title: `Reorder ${lines.map((l) => l.name.toLowerCase()).join(" and ")} from ${supplier}`,
      summary: `${spoken} from ${supplier}, needed by ${neededByDate}.`,
      rationale: `Short ${lines
        .map((l) => `${items.find((i) => i.ingredientId === l.ingredientId)?.shortfall.toFixed(2)} ${l.unit} ${l.name.toLowerCase()}`)
        .join(", ")} for the planned orders.`,
      totalCents,
      ingredientIds: lines.map((l) => l.ingredientId),
    };
  });
}

function describe(
  days: PlannedDay[],
  unfulfilled: OrderLine[],
  needs: IngredientNeed[],
  business: BusinessProfile,
): string {
  const parts: string[] = [];
  for (const day of days) {
    const units = day.items.reduce((s, i) => s + i.qty, 0);
    parts.push(`${weekdayOf(day.localDate, business.timezone)} ${units}`);
  }
  if (parts.length === 0) parts.push("nothing fits in range");

  const short = needs.filter((n) => n.shortfall > 0);
  const stock = short.length
    ? ` short ${short.map((n) => `${n.shortfall.toFixed(2)} ${n.unit} ${n.name.toLowerCase()}`).join(", ")}`
    : " stock covers it";
  const missed = unfulfilled.length
    ? ` could not place ${unfulfilled.reduce((s, u) => s + u.qty, 0)} units`
    : "";

  return `plan ${parts.join(" + ")};${stock}${missed}`;
}
