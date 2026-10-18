/**
 * The proactive beat: find a regular who has quietly stopped coming in.
 *
 * Runs on demand (`POST /dev/winback-scan`, or the control room's "Morning scan"), not
 * on a timer. Shared Photon lines cannot start a conversation, so a draft for someone
 * with no open conversation says so on its face and executes as simulated.
 */
import type { AgentContext, Evidence, ProposalDraft, RegularCadence, RiskFlag } from "@boh/shared";
import { PAYMENT_LINK_TOKEN } from "@boh/shared";
import { recordReads } from "./reads.ts";
import { computeUsual } from "./usual.ts";
import { friendlyPickup, isoWithOffset, localDate, nextSaturdayAndSunday } from "./time.ts";

/**
 * Customers contacted this recently are excluded, however overdue they look.
 *
 * Ranking by overdue ratio alone picks the most frequent customer, not the one who has
 * drifted: a weekly regular six weeks out is 6x overdue, a fortnightly one six weeks
 * out is only 3x. In this seed that puts Maya — who is texting live during the demo —
 * ahead of Elena, who is the actual lapsed regular. Anyone mid-conversation is not a
 * win-back candidate, so they are filtered before ranking rather than re-weighted.
 */
export const RECENT_CONTACT_DAYS = 7;

export async function runWinbackScan(ctx: AgentContext): Promise<ProposalDraft[]> {
  const port = recordReads(ctx.data);
  const business = ctx.business;
  const now = ctx.now();
  const todayLocal = localDate(now, business.timezone);
  const startedAt = Date.now();

  const cadences = await port.getRegularCadences();

  const eligible = cadences.filter(
    (c) =>
      c.orderCount >= business.winbackMinOrders &&
      c.medianIntervalDays > 0 &&
      c.daysSinceLast > business.winbackOverdueFactor * c.medianIntervalDays &&
      // Anyone mid-conversation is not a win-back candidate, however lapsed their
      // orders look. `daysSinceLast` counts orders, so a customer texting right now
      // still reads as maximally overdue — which is how the most frequent regular
      // outranks the one who actually drifted away.
      !(c.daysSinceLastContact !== undefined && c.daysSinceLastContact <= RECENT_CONTACT_DAYS),
  );

  // Most days overdue beyond their own rhythm, not the largest ratio.
  const ranked = [...eligible].sort(
    (a, b) =>
      b.daysSinceLast - b.medianIntervalDays * business.winbackOverdueFactor -
      (a.daysSinceLast - a.medianIntervalDays * business.winbackOverdueFactor),
  );

  ctx.trace("context", {
    agent: "winback",
    step: "context",
    ms: Date.now() - startedAt,
    summary: `${cadences.length} customers with history, ${ranked.length} overdue past ${business.winbackOverdueFactor}x their own cadence`,
    reads: port.reads(),
    flags: [],
  });

  // Walk the ranking rather than taking only the first: a win-back message is built
  // from someone's usual, and the most overdue customer often turns out to be an
  // occasional visitor with no habit to reference. Giving up on them means offering
  // nothing at all, when the next name down has a usual we can be specific about.
  let candidate: RegularCadence | undefined;
  let usual: ReturnType<typeof computeUsual> = null;
  const skipped: string[] = [];

  for (const option of ranked.slice(0, 5)) {
    const theirUsual = computeUsual(await port.getOrderHistory(option.customerId, 12));
    if (theirUsual) {
      candidate = option;
      usual = theirUsual;
      break;
    }
    skipped.push(option.name);
  }

  if (!candidate || !usual) {
    ctx.trace("plan", {
      agent: "winback",
      step: "plan",
      ms: Date.now() - startedAt,
      summary:
        ranked.length === 0
          ? "nobody is overdue past their own cadence"
          : `${ranked.length} overdue, but none of the top candidates has a clear usual to offer`,
      reads: port.reads(),
      flags: [],
    });
    return [];
  }

  if (skipped.length > 0) {
    ctx.trace("resolve", {
      agent: "winback",
      step: "resolve",
      ms: Date.now() - startedAt,
      summary: `skipped ${skipped.join(", ")}: overdue but no clear usual to reference`,
      reads: [],
      flags: [],
    });
  }

  const catalog = await port.getCatalog();
  const { sat } = nextSaturdayAndSunday(todayLocal, business.timezone);
  const pickupLocal = `${sat}T${business.hours.sat?.open ?? "09:00"}`;
  const first = candidate.name.split(/\s+/)[0] ?? candidate.name;

  const itemLabel = usual.items
    .map((i) => `${i.qty} ${(catalog.find((p) => p.id === i.productId)?.name ?? i.productId).toLowerCase()}`)
    .join(" and ");

  const flags: RiskFlag[] = [];
  if (!candidate.hasOpenConversation) flags.push("low_confidence");

  const evidence: Evidence[] = [
    {
      label: "Cadence",
      value: `Orders about every ${candidate.medianIntervalDays} days across ${candidate.orderCount} orders`,
      source: { table: "customers", id: candidate.customerId },
    },
    {
      label: "Last visit",
      value: `${candidate.daysSinceLast} days ago, ${(candidate.daysSinceLast / candidate.medianIntervalDays).toFixed(1)}x her usual gap`,
      source: { table: "orders", id: usual.sourceOrderId },
    },
    {
      label: "Usual order",
      value: `${itemLabel} (${usual.seenIn} of last ${usual.of})`,
      source: { table: "orders", id: usual.sourceOrderId },
    },
    {
      label: "Perk",
      value: `Welcome back 10% eligible (over ${business.welcomeBackAfterDays} days)`,
      source: { table: "business", id: "welcomeBackAfterDays" },
    },
  ];

  const reachable = candidate.hasOpenConversation;
  const text = `Hi ${first} — we've got ${itemLabel} with your name on it if you want them ${friendlyPickup(pickupLocal, business.timezone)}. 10% off, welcome back. ${PAYMENT_LINK_TOKEN}`;

  ctx.trace("plan", {
    agent: "winback",
    step: "plan",
    ms: Date.now() - startedAt,
    summary: `${candidate.name} orders every ~${candidate.medianIntervalDays} days and it has been ${candidate.daysSinceLast}${reachable ? "" : "; no open conversation, so this would send when Photon allows outbound"}`,
    reads: port.reads(),
    flags,
  });

  return [
    {
      kind: "reply",
      agent: "winback",
      title: `Win back ${first}`,
      summary: reachable
        ? `${itemLabel} for ${friendlyPickup(pickupLocal, business.timezone)}, 10% off.`
        : `${itemLabel} for ${friendlyPickup(pickupLocal, business.timezone)}, 10% off. No open conversation: would send when Photon allows outbound.`,
      rationale: `${first} orders every ~${candidate.medianIntervalDays} days; it has been ${candidate.daysSinceLast}.`,
      payload: {
        text,
        orders: [
          {
            items: usual.items,
            pickupAt: isoWithOffset(pickupLocal, business.timezone),
            perk: "welcome_back_10",
          },
        ],
      },
      evidence,
      reads: port.reads(),
      confidence: reachable ? 0.8 : 0.5,
      riskFlags: flags,
    },
  ];
}
