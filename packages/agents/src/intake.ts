/**
 * The Intake pipeline: one inbound message becomes proposals the owner can approve.
 *
 * A fixed sequence of steps, not a free-running tool loop. Each step traces what it did
 * with the numbers it used, so the ticket can show the shop's reasoning rather than a
 * summary of it. The two model calls are bounded and both have deterministic fallbacks;
 * a step that fails degrades the draft's confidence instead of losing the message.
 *
 * Never throws for a model problem. The owner always gets something to look at.
 */
import type {
  AgentContext,
  CustomerProfile,
  Evidence,
  InboundInput,
  OrderDraft,
  OrderLine,
  OrderSummary,
  Product,
  ProposalDraft,
  RiskFlag,
} from "@boh/shared";
import { PAYMENT_LINK_TOKEN } from "@boh/shared";
import { recordReads } from "./reads.ts";
import { computeUsual, daysSinceLastOrder, type Usual } from "./usual.ts";
import { planFulfillment, planReorder, type FulfillmentPlan } from "./ops.ts";
import { checkInbound, checkReply } from "./guard.ts";
import { Budget, generateStructured, isModelConfigured } from "./model.ts";
import { DRAFT_SYSTEM, draftPrompt } from "./prompts/draft.ts";
import { matchItems, understand, type Understanding } from "./understand.ts";
import {
  allergyEvidence,
  capacityEvidence,
  customerEvidence,
  lastVisitEvidence,
  perkEvidence,
  planEvidence,
  priceEvidence,
  stockEvidence,
  unfulfilledEvidence,
  usualEvidence,
} from "./evidence.ts";
import { checkHours, friendlyPickup, hoursUntil, isoWithOffset, localDate, localTime, weekdayOf } from "./time.ts";
import { z } from "zod";

const DraftText = z.object({ text: z.string().min(1).max(600) });

/**
 * Notes only count as an allergy when they say so.
 *
 * Maya's note is "Usual is 2 almond croissants…", and matching allergen words against
 * the whole note flagged her own favourite order as an allergy risk — wrong flag and a
 * wrong sentence on the demo's happiest ticket.
 */
const ALLERGY_INDICATOR = /\b(allerg(y|ic|ies)|intoleran(t|ce)|can'?t have|cannot eat|celiac|coeliac|anaphyla)/i;

/** Allergen keywords per product, for matching a customer's noted allergy to the menu. */
const ALLERGEN_KEYWORDS: Record<string, readonly string[]> = {
  "almond-flour": ["nut", "almond", "tree nut"],
  "oat-milk": ["oat", "gluten"],
  butter: ["dairy", "milk", "lactose"],
  "cream-cheese": ["dairy", "milk", "lactose"],
  eggs: ["egg"],
  "bread-flour": ["gluten", "wheat"],
  "whole-milk": ["dairy", "milk", "lactose"],
};

export async function handleInbound(input: InboundInput, ctx: AgentContext): Promise<ProposalDraft[]> {
  const port = recordReads(ctx.data);
  const budget = new Budget();
  const now = ctx.now();
  const business = ctx.business;
  const todayLocal = localDate(now, business.timezone);
  const flags = new Set<RiskFlag>();

  try {
    // 1. Context ------------------------------------------------------------
    const step1 = Date.now();
    const conversation = await port.getConversation(input.conversationId, 20);
    const inbound =
      [...conversation.messages].reverse().find((m) => m.id === input.messageId && m.direction === "inbound") ??
      [...conversation.messages].reverse().find((m) => m.direction === "inbound");
    const text = inbound?.body ?? "";

    const customer = conversation.customerId
      ? await port.getCustomer(conversation.customerId)
      : await port.getCustomerByHandle(conversation.handle);

    const [catalog, history] = await Promise.all([
      port.getCatalog(),
      customer ? port.getOrderHistory(customer.id, 12) : Promise.resolve<OrderSummary[]>([]),
    ]);

    const usual = computeUsual(history);
    const daysSince = daysSinceLastOrder(history, now);

    ctx.trace("context", {
      agent: "intake",
      step: "context",
      ms: Date.now() - step1,
      summary: customer
        ? `${customer.name}: ${history.length} past orders${usual ? `, usual is ${usual.seenIn} of ${usual.of}` : ", no clear usual"}`
        : `New number ${maskHandle(conversation.handle)}, no history`,
      reads: port.reads(),
      flags: [],
    });

    if (!customer) flags.add("new_customer");

    // 2. Understand ---------------------------------------------------------
    const reading = await understand(
      {
        text,
        catalog,
        todayLocal,
        timezone: business.timezone,
        nowLocal: `${todayLocal}T${localTime(now, business.timezone)}`,
        customerName: customer?.name,
        recentTurns: conversation.messages.map((m) => ({ direction: m.direction, body: m.body })),
      },
      budget,
    );

    for (const flag of checkInbound(text, reading.value)) flags.add(flag);

    ctx.trace("understand", {
      agent: "intake",
      step: "understand",
      ms: reading.ms,
      summary: `${reading.value.intent}${reading.value.items.length ? `, ${reading.value.items.map((i) => `${i.qty}x ${i.productId}`).join(", ")}` : ""}${
        reading.value.pickupLocal ? ` for ${reading.value.pickupLocal}` : ""
      }${reading.source === "deterministic" ? ` (read without the model: ${reading.fallbackReason ?? "unknown"})` : ""}`,
      reads: [],
      flags: [...flags],
      source: reading.source,
      ...(reading.fallbackReason ? { fallbackReason: reading.fallbackReason } : {}),
    });

    // 3. Resolve ------------------------------------------------------------
    const step3 = Date.now();
    const resolved = resolveRequest(reading.value, usual, catalog, customer, business, now, todayLocal, flags, text);

    ctx.trace("resolve", {
      agent: "intake",
      step: "resolve",
      ms: Date.now() - step3,
      summary: resolved.items.length
        ? `${resolved.items.reduce((s, i) => s + i.qty, 0)} units for ${resolved.pickupLocal ?? "no time given"}`
        : "nothing orderable in this message",
      reads: [],
      flags: [...flags],
    });

    // 4 and 5. Capacity, stock, and the plan --------------------------------
    let plan: FulfillmentPlan | null = null;
    if (resolved.items.length > 0 && resolved.pickupLocal) {
      const step4 = Date.now();
      plan = await planFulfillment(resolved.items, resolved.pickupLocal, port, business, 3);
      for (const flag of plan.flags) flags.add(flag);

      ctx.trace("ops_check", {
        agent: "ops",
        step: "ops_check",
        ms: Date.now() - step4,
        summary: plan.summary,
        reads: port.reads(),
        flags: plan.flags,
      });
    }

    const reorders =
      plan && plan.needs.some((n) => n.shortfall > 0)
        ? planReorder(plan.needs, business, plan.days[0]?.localDate ?? todayLocal)
        : [];

    if (plan?.capacitySplit || reorders.length > 0) {
      ctx.trace("plan", {
        agent: "ops",
        step: "plan",
        ms: 0,
        summary: reorders.length
          ? `${plan?.days.length ?? 0} order(s) plus ${reorders.map((r) => r.summary).join("; ")}`
          : `${plan?.days.length ?? 0} order(s), stock covers it`,
        reads: [],
        flags: [...flags],
      });
    }

    // 6. Draft --------------------------------------------------------------
    const perkApplies =
      Boolean(plan?.days.length) && daysSince !== null && daysSince > business.welcomeBackAfterDays;

    const evidence = buildEvidence({
      customer,
      history,
      usual,
      catalog,
      plan,
      daysSince,
      perkApplies,
      business,
      reading: reading.value,
      mentioned: resolved.mentioned,
    });

    const facts = factLines({ plan, catalog, business, reading: reading.value, perkApplies, resolved, usual });
    const step6 = Date.now();
    const drafted = await draftReply({
      budget,
      business,
      customer,
      text,
      facts,
      hasOrder: Boolean(plan?.days.length),
      flags,
      plan,
      catalog,
      reading: reading.value,
      resolved,
    });

    ctx.trace("draft", {
      agent: "intake",
      step: "draft",
      ms: Date.now() - step6,
      summary: `${drafted.source === "model" ? "Model drafted" : "Composed without the model"}: ${truncate(drafted.text, 90)}`,
      reads: [],
      flags: [...flags],
    });

    // 7. Guard --------------------------------------------------------------
    const step7 = Date.now();
    const otherNames = [...new Set(history.map(() => "").filter(Boolean))];
    let guard = checkReply(drafted.text, {
      hasOrder: Boolean(plan?.days.length),
      perkApplies,
      allergyFlagged: flags.has("allergy_mentioned"),
      catalog,
      otherCustomerNames: otherNames,
      customerFirstName: firstName(customer),
      inboundText: text,
      modelFlags: reading.value,
      poweredByFooter: business.poweredByFooter,
    });

    let finalText = drafted.text;
    if (!guard.ok && drafted.source === "model" && !budget.exhausted()) {
      // One redraft with the guard's own complaints as the instructions.
      const retry = await draftReply({
        budget,
        business,
        customer,
        text,
        facts,
        hasOrder: Boolean(plan?.days.length),
        flags,
        plan,
        catalog,
        reading: reading.value,
        resolved,
        fixes: guard.blocking,
      });
      const retryGuard = checkReply(retry.text, {
        hasOrder: Boolean(plan?.days.length),
        perkApplies,
        allergyFlagged: flags.has("allergy_mentioned"),
        catalog,
        otherCustomerNames: otherNames,
        customerFirstName: firstName(customer),
        inboundText: text,
        modelFlags: reading.value,
        poweredByFooter: business.poweredByFooter,
      });
      if (retryGuard.ok || retryGuard.blocking.length < guard.blocking.length) {
        finalText = retry.text;
        guard = retryGuard;
      }
    }

    if (!guard.ok) {
      // The owner decides. A draft that still fails ships with the flag on its face.
      flags.add("low_confidence");
    }
    for (const flag of guard.flags) flags.add(flag);

    ctx.trace("guard", {
      agent: "guard",
      step: "guard",
      ms: Date.now() - step7,
      summary: guard.summary,
      reads: [],
      flags: guard.flags,
    });

    // 8. Build the drafts ---------------------------------------------------
    const orders = buildOrders(plan, business, perkApplies);
    const confidence = Math.max(0.05, Math.min(reading.value.confidence, 1) * guard.confidencePenalty);

    const reply: ProposalDraft = {
      kind: "reply",
      agent: "intake",
      title: replyTitle(customer, reading.value, plan),
      summary: replySummary(plan, catalog, business, reading.value),
      rationale: rationale(plan, reorders.length > 0, catalog, business, reading.value, flags),
      payload: { text: finalText, orders },
      evidence,
      reads: port.reads(),
      confidence: Number(confidence.toFixed(2)),
      riskFlags: [...flags],
    };

    const drafts: ProposalDraft[] = [reply];
    for (const reorder of reorders) {
      drafts.push({
        kind: "reorder",
        agent: "ops",
        title: truncate(reorder.title, 80),
        summary: truncate(`${reorder.summary} About $${(reorder.totalCents / 100).toFixed(2)}.`, 280),
        rationale: truncate(reorder.rationale, 160),
        payload: reorder.payload,
        evidence: reorder.ingredientIds
          .map((id) => plan?.needs.find((n) => n.ingredientId === id))
          .filter((n): n is NonNullable<typeof n> => Boolean(n))
          .map(stockEvidence),
        reads: port.reads(),
        confidence: 0.9,
        riskFlags: ["ingredient_shortfall"],
        // Links this reorder to the reply, so the owner can approve the set.
        parentIndex: 0,
      });
    }

    return drafts;
  } catch (error) {
    // 9. Never throw for a model or data problem.
    ctx.trace("draft", {
      agent: "intake",
      step: "draft",
      ms: 0,
      summary: `Pipeline failed, sent the safe fallback: ${error instanceof Error ? error.message : String(error)}`,
      reads: port.reads(),
      flags: ["low_confidence"],
      error: error instanceof Error ? error.message : String(error),
    });

    return [
      {
        kind: "reply",
        agent: "intake",
        title: "Needs a human reply",
        summary: "The agent could not read this message, so it drafted a holding reply for the owner to edit.",
        rationale: "Pipeline error; no order was created.",
        payload: { text: "Thanks for the message! We'll get back to you shortly.", orders: [] },
        evidence: [],
        reads: port.reads(),
        confidence: 0.1,
        riskFlags: ["low_confidence", "needs_clarification"],
      },
    ];
  }
}

// ---------------------------------------------------------------------------
// Step 3: deterministic resolution
// ---------------------------------------------------------------------------

interface Resolved {
  items: OrderLine[];
  pickupLocal: string | null;
  isCatering: boolean;
  totalCents: number;
  /** Products the message names, whether or not it is an order. Price questions need this. */
  mentioned: OrderLine[];
}

function resolveRequest(
  reading: Understanding,
  usual: Usual | null,
  catalog: Product[],
  customer: CustomerProfile | null,
  business: AgentContext["business"],
  now: Date,
  todayLocal: string,
  flags: Set<RiskFlag>,
  rawText: string,
): Resolved {
  const known = new Map(catalog.map((p) => [p.id, p]));

  let items: OrderLine[] = reading.items.filter((i) => known.has(i.productId));
  if (items.length !== reading.items.length) flags.add("needs_clarification");

  // "the usual", and the ways people say it without saying it.
  const wantsUsual =
    reading.intent === "order_usual" || /\b(same as (last|before|always)|the usual|my usual)\b/i.test(rawText);

  if (wantsUsual && items.length === 0) {
    if (usual) {
      // "same as last time but double" is a real order, not a clarification.
      const multiplier = /\bdouble\b/i.test(rawText) ? 2 : /\btriple\b/i.test(rawText) ? 3 : 1;
      items = usual.items
        .filter((i) => known.has(i.productId))
        .map((i) => ({ productId: i.productId, qty: i.qty * multiplier }));
    } else {
      flags.add("needs_clarification");
    }
  }

  // The model sets needsClarification when it cannot tell what was ordered. If resolve
  // then recovered items anyway — most often from the customer's usual, which the model
  // has no way to know — the question has been answered and asking it again reads as
  // broken.
  if (reading.needsClarification && items.length === 0) flags.add("needs_clarification");

  const units = items.reduce((sum, i) => sum + i.qty, 0);
  const totalCents = items.reduce((sum, i) => sum + (known.get(i.productId)?.priceCents ?? 0) * i.qty, 0);
  const isCatering = units >= business.cateringThresholdUnits;

  let pickupLocal = reading.pickupLocal;
  if (items.length > 0 && !pickupLocal) flags.add("needs_clarification");

  if (pickupLocal) {
    const hours = checkHours(pickupLocal, business);
    if (!hours.open) {
      flags.add("outside_hours");
    } else if (!hours.withinHours) {
      flags.add("outside_hours");
      // Keep the day, move to opening time: a 7am Saturday ask becomes 8am.
      pickupLocal = `${pickupLocal.slice(0, 10)}T${hours.opensAt}`;
    }

    const lead = hoursUntil(pickupLocal, now, business.timezone);
    const required = isCatering ? business.cateringLeadHours : business.minLeadHours;
    if (lead < required) flags.add("short_notice");
  }

  if (totalCents > business.largeOrderCents) flags.add("large_order");

  // An allergy on the customer's record, or raised in this message, against what they
  // asked for. The record only counts when it actually describes an allergy.
  const notes = customer?.notes ?? "";
  const recordHasAllergy = ALLERGY_INDICATOR.test(notes);
  if (reading.mentionsAllergy) {
    flags.add("allergy_mentioned");
  } else if (recordHasAllergy && items.length > 0 && items.some((item) => allergenRisk(item.productId, notes))) {
    flags.add("allergy_mentioned");
  }

  if (reading.intent === "complaint") flags.add("complaint");

  return { items, pickupLocal, isCatering, totalCents, mentioned: matchItems(rawText, catalog) };
}

/** Does a product contain something the noted allergy mentions? */
function allergenRisk(productId: string, notes: string): boolean {
  const lower = notes.toLowerCase();
  // Without recipe access here, match on the product id's own words plus known mappings.
  for (const [ingredientId, words] of Object.entries(ALLERGEN_KEYWORDS)) {
    if (!words.some((w) => lower.includes(w))) continue;
    const stem = ingredientId.split("-")[0] ?? "";
    if (productId.includes(stem)) return true;
  }
  return /\b(nut|almond)\b/.test(lower) && productId.includes("almond");
}

// ---------------------------------------------------------------------------
// Step 6: the reply text
// ---------------------------------------------------------------------------

interface DraftArgs {
  budget: Budget;
  business: AgentContext["business"];
  customer: CustomerProfile | null;
  text: string;
  facts: string[];
  hasOrder: boolean;
  flags: Set<RiskFlag>;
  plan: FulfillmentPlan | null;
  catalog: Product[];
  reading: Understanding;
  resolved: Resolved;
  fixes?: string[];
}

async function draftReply(args: DraftArgs): Promise<{ text: string; source: "model" | "composed" }> {
  if (isModelConfigured() && !args.budget.exhausted()) {
    try {
      const result = await generateStructured({
        schema: DraftText,
        system: DRAFT_SYSTEM,
        prompt: draftPrompt({
          customerFirstName: firstName(args.customer),
          voice: args.business.voice,
          facts: args.facts,
          paymentLink: args.hasOrder ? "required" : "none",
          fixes: args.fixes,
          inboundText: args.text,
        }),
        temperature: 0.6,
        budget: args.budget,
        step: "draft",
      });
      return { text: result.value.text.trim(), source: "model" };
    } catch {
      // Compose it instead.
    }
  }
  return { text: composeReply(args), source: "composed" };
}

/**
 * The deterministic reply. Less charming than the model's, but it is always available,
 * always on-policy, and good enough to demo if the venue network dies.
 */
function composeReply(args: DraftArgs): string {
  const { business, catalog, flags, plan, reading } = args;
  const name = firstName(args.customer);
  const hi = name ? `Hi ${name}` : "Hi";
  const label = (line: OrderLine): string =>
    `${line.qty} ${(catalog.find((p) => p.id === line.productId)?.name ?? line.productId).toLowerCase()}`;

  if (flags.has("injection_suspected") || flags.has("off_policy")) {
    const coldBrew = catalog.find((p) => p.id === "cold-brew");
    const offer = coldBrew ? ` Our ${coldBrew.name.toLowerCase()} is $${(coldBrew.priceCents / 100).toFixed(2)} if you'd like one.` : "";
    return `${hi} — we can't do that one, sorry.${offer}`;
  }
  if (flags.has("abusive") || reading.abusive) {
    return "We'd rather keep things friendly here. Happy to help if you'd like to order something.";
  }
  if (reading.offTopic) {
    return "We're just the coffee shop, so that one's outside our wheelhouse. Can we get you a coffee or something from the case?";
  }
  if (reading.intent === "complaint") {
    return `${hi} — sorry that happened. The owner will take a look and get back to you today.`;
  }
  if (reading.intent === "question_hours") {
    const today = business.hours[weekdayOf(localDate(new Date(), business.timezone), business.timezone)];
    const sat = business.hours.sat;
    const sun = business.hours.sun;
    return `${hi} — we're open Tuesday to Friday ${business.hours.tue?.open}–${business.hours.tue?.close}, Saturday ${sat?.open}–${sat?.close} and Sunday ${sun?.open}–${sun?.close}. Closed Mondays.${today ? "" : " We're closed today."}`;
  }
  if (flags.has("needs_clarification") || !plan || plan.days.length === 0) {
    return `${hi} — happy to help. What would you like, how many, and when would you like to pick it up?`;
  }

  const [first, second] = plan.days;
  const allergyLine = flags.has("allergy_mentioned")
    ? " We've got your allergy noted and the owner will confirm before we bake."
    : "";

  if (second) {
    const firstUnits = first?.items.map(label).join(" and ") ?? "";
    const secondUnits = second.items.map(label).join(" and ");
    return `${hi} — we can't fit all of that on ${weekdayLabel(first?.localDate ?? "", business.timezone)}; it's nearly full. We can do ${firstUnits} ${friendlyPickup(first?.pickupLocal ?? "", business.timezone)} and ${secondUnits} ${friendlyPickup(second.pickupLocal, business.timezone)}. Paying here confirms both: ${PAYMENT_LINK_TOKEN}${allergyLine}`;
  }

  const units = first?.items.map(label).join(" and ") ?? "";
  const perk = args.facts.some((f) => f.startsWith("Perk")) ? " 10% off, welcome back." : "";
  return `${hi} — ${units} for ${friendlyPickup(first?.pickupLocal ?? "", business.timezone)}, got it.${perk} Here's the link to confirm: ${PAYMENT_LINK_TOKEN}${allergyLine}`;
}

function factLines(args: {
  plan: FulfillmentPlan | null;
  catalog: Product[];
  business: AgentContext["business"];
  reading: Understanding;
  perkApplies: boolean;
  resolved: Resolved;
  usual: Usual | null;
}): string[] {
  const { plan, catalog, business, reading, perkApplies, resolved } = args;
  const nameOf = (id: string): string => catalog.find((p) => p.id === id)?.name ?? id;
  const lines: string[] = [];

  for (const day of plan?.days ?? []) {
    lines.push(
      `Can make: ${day.items.map((i) => `${i.qty}x ${nameOf(i.productId)}`).join(", ")}, pickup ${friendlyPickup(day.pickupLocal, business.timezone)}`,
    );
  }
  if (plan && plan.days.length > 1) {
    lines.push(
      `Could not fit the whole order on ${weekdayLabel(plan.days[0]?.localDate ?? "", business.timezone)}: that day is nearly full. Paying the one link confirms both pickups.`,
    );
  }
  for (const missed of plan?.unfulfilled ?? []) {
    lines.push(`Cannot make at all in the next few days: ${missed.qty}x ${nameOf(missed.productId)}`);
  }
  if (perkApplies) lines.push("Perk: 10% off, welcome back (the customer has not ordered in over a month)");
  if (reading.intent === "question_menu" || reading.intent === "question_hours") {
    lines.push(`Shop hours: Tue-Fri ${business.hours.tue?.open}-${business.hours.tue?.close}, Sat-Sun ${business.hours.sat?.open}-${business.hours.sat?.close}, closed Monday`);
  }

  // A price question only gets answered if the price is in the facts; the model is not
  // allowed to recall one. Only when nothing is being ordered, so a draft reply never
  // states a line price next to an order the server is about to price itself.
  if (!plan || plan.days.length === 0) {
    for (const item of resolved.mentioned) {
      const product = catalog.find((p) => p.id === item.productId);
      if (product) lines.push(`Menu price: ${product.name} is $${(product.priceCents / 100).toFixed(2)} each`);
    }
  }
  if (reading.needsClarification && reading.clarifyingQuestion && resolved.items.length === 0) {
    lines.push(`Needs clarification: ${reading.clarifyingQuestion}`);
  }
  if (resolved.items.length > 0 && !plan) {
    lines.push("No pickup time was given, so nothing is scheduled yet.");
  }
  if (lines.length === 0) lines.push("Nothing orderable in this message; answer the question or redirect politely.");
  return lines;
}

// ---------------------------------------------------------------------------
// Step 8: assembling the drafts
// ---------------------------------------------------------------------------

function buildOrders(plan: FulfillmentPlan | null, business: AgentContext["business"], perkApplies: boolean): OrderDraft[] {
  if (!plan) return [];
  return plan.days.slice(0, 2).map((day, index) => ({
    items: day.items,
    pickupAt: isoWithOffset(day.pickupLocal, business.timezone),
    // The server re-checks eligibility; the perk only ever lands on the first order.
    ...(perkApplies && index === 0 ? { perk: "welcome_back_10" as const } : {}),
  }));
}

function buildEvidence(args: {
  customer: CustomerProfile | null;
  history: OrderSummary[];
  usual: Usual | null;
  catalog: Product[];
  plan: FulfillmentPlan | null;
  daysSince: number | null;
  perkApplies: boolean;
  business: AgentContext["business"];
  reading: Understanding;
  mentioned: OrderLine[];
}): Evidence[] {
  const { customer, history, usual, catalog, plan, daysSince, perkApplies, business, reading, mentioned } = args;
  const rows: Evidence[] = [];

  const oldest = history.length > 0 ? history[history.length - 1] : undefined;
  rows.push(customerEvidence(customer, history.length, oldest?.createdAt));

  if (usual) rows.push(usualEvidence(usual, catalog));
  if (daysSince !== null && history[0]) rows.push(lastVisitEvidence(daysSince, history[0]));

  if (customer?.notes && /allerg/i.test(customer.notes)) rows.push(allergyEvidence(customer.id, customer.notes));

  for (const day of plan?.days ?? []) {
    for (const item of day.items) {
      const load = plan?.loads[day.localDate] ?? [];
      const row = capacityEvidence(day.localDate, load, item.productId, business.timezone);
      if (row) rows.push(row);
    }
  }

  for (const need of plan?.needs ?? []) {
    if (need.shortfall > 0) rows.push(stockEvidence(need));
  }

  if (plan && plan.days.length > 0) rows.push(planEvidence(plan.days, catalog, business.timezone));
  const missed = unfulfilledEvidence(plan?.unfulfilled ?? [], catalog);
  if (missed) rows.push(missed);

  if (perkApplies && daysSince !== null) rows.push(perkEvidence(daysSince, business.welcomeBackAfterDays));

  // A straight price question deserves the price it asked about, from the catalog.
  if (reading.intent === "question_menu") {
    for (const item of mentioned) {
      const product = catalog.find((p) => p.id === item.productId);
      if (product) rows.push(priceEvidence(product));
    }
  }

  // De-duplicate by label and value: two days of the same product read the same row.
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.label}|${row.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function replyTitle(customer: CustomerProfile | null, reading: Understanding, plan: FulfillmentPlan | null): string {
  const who = customer ? firstName(customer) : "New number";
  if (plan && plan.days.length > 1) return truncate(`${who}: counteroffer across two days`, 80);
  if (plan && plan.days.length === 1) return truncate(`${who}: order for ${plan.days[0]?.localDate.slice(5)}`, 80);
  if (reading.intent === "complaint") return truncate(`${who}: complaint`, 80);
  if (reading.intent.startsWith("question")) return truncate(`${who}: question`, 80);
  return truncate(`${who}: reply`, 80);
}

function replySummary(
  plan: FulfillmentPlan | null,
  catalog: Product[],
  business: AgentContext["business"],
  reading: Understanding,
): string {
  if (!plan || plan.days.length === 0) return truncate(`Reply only, no order. Read as ${reading.intent}.`, 280);
  const parts = plan.days.map(
    (day) =>
      `${day.items.map((i) => `${i.qty}x ${catalog.find((p) => p.id === i.productId)?.name ?? i.productId}`).join(", ")} ${friendlyPickup(day.pickupLocal, business.timezone)}`,
  );
  return truncate(parts.join(" · "), 280);
}

function rationale(
  plan: FulfillmentPlan | null,
  hasReorder: boolean,
  catalog: Product[],
  business: AgentContext["business"],
  reading: Understanding,
  flags: Set<RiskFlag>,
): string {
  if (plan && plan.days.length > 1) {
    const first = plan.days[0];
    const second = plan.days[1];
    const total = plan.days.flatMap((d) => d.items).reduce((s, i) => s + i.qty, 0);
    const base = `Can't fit ${total} on ${weekdayLabel(first?.localDate ?? "", business.timezone)}: split ${first?.items.reduce((s, i) => s + i.qty, 0)} / ${second?.items.reduce((s, i) => s + i.qty, 0)}`;
    return truncate(hasReorder ? `${base}, reorder needed` : base, 160);
  }
  if (flags.has("injection_suspected") || flags.has("off_policy")) {
    return "Off-policy ask: declined it and offered something from the menu. No order.";
  }
  if (plan && plan.days.length === 1) {
    return truncate(`Capacity and stock both cover it for ${weekdayLabel(plan.days[0]?.localDate ?? "", business.timezone)}.`, 160);
  }
  if (flags.has("needs_clarification")) return "Not enough detail to place an order; asked one question.";
  return truncate(`Read as ${reading.intent}; answered without creating an order.`, 160);
}

// ---------------------------------------------------------------------------

const firstName = (customer: CustomerProfile | null): string | undefined => customer?.name.split(/\s+/)[0];

const weekdayLabel = (localDateString: string, timezone: string): string => {
  if (!localDateString) return "that day";
  const key = weekdayOf(localDateString, timezone);
  return { sun: "Sunday", mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday" }[key];
};

const truncate = (text: string, max: number): string => (text.length <= max ? text : `${text.slice(0, max - 1)}…`);

/** Handles never reach a trace or a log in full. */
const maskHandle = (handle: string): string => (handle.length > 4 ? `…${handle.slice(-4)}` : "unknown");
