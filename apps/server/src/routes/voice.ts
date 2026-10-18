import { timingSafeEqual } from "node:crypto";
import { handleVoiceTurn, VoiceToolRequest } from "@boh/agents";
import type { Product } from "@boh/shared";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { z } from "zod";
import { business } from "../business.ts";
import { supabaseDataPort as data } from "../data-port.ts";
import { db } from "../db.ts";
import { env, features } from "../env.ts";
import { logEvent } from "../events.ts";
import { agentContext, ingestInbound, storeDrafts } from "../inbound.ts";
import { localDateOf, resolveSpokenDay, weekdayOf } from "../time.ts";
import { productFacts } from "../facts.ts";
import { linkCall } from "../voice/calls.ts";

/**
 * Tools the ElevenLabs phone agent calls mid-call. They answer from the same live data the text
 * agents read, and never send, charge, or commit anything: an order becomes a pending ticket.
 */
export const voice = new Hono();

const requireVoiceSecret = createMiddleware(async (c, next) => {
  if (!env.VOICE_TOOL_SECRET) return c.json({ error: "VOICE_TOOL_SECRET is not configured on the server" }, 503);
  if (!features.database) return c.json({ error: "Database is not configured on the server" }, 503);
  const given = Buffer.from(c.req.header("x-voice-secret") ?? "");
  const expected = Buffer.from(env.VOICE_TOOL_SECRET);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return c.json({ error: "Invalid voice secret" }, 401);
  await next();
});
voice.use("/tools/*", requireVoiceSecret);

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const plain = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const singular = (s: string) => s.replace(/(es|s)$/, "");
const plural = (n: number, name: string) => (n === 1 || /s$/.test(name) ? name : `${name}s`);

/** Matches what a caller said ("milk cakes", "a cold brew") to a menu item by id, name, or alias. */
function findProduct(catalog: Product[], spoken: string): Product | null {
  const want = plain(spoken).replace(/^(a|an|the|some)\s+/, "");
  const names = (p: Product) => [p.id.replace(/-/g, " "), p.name, ...p.aliases].map(plain);
  return (
    catalog.find((p) => names(p).includes(want)) ??
    catalog.find((p) => names(p).some((n) => singular(n) === singular(want))) ??
    catalog.find((p) => names(p).some((n) => n.includes(want) || want.includes(n))) ??
    null
  );
}

const AvailabilityRequest = z.object({
  /** What the caller is asking about. Empty means "what do you have": the whole menu for that day. */
  items: z.array(z.object({ item: z.string().min(1), quantity: z.coerce.number().int().positive().optional() })).max(10).default([]),
  /** "today", "tomorrow", "Saturday", or YYYY-MM-DD. Defaults to today. */
  day: z.string().optional(),
  /** ElevenLabs' conversation id, so the call's transcript joins the same thread. */
  callId: z.string().optional(),
});

/** Is it on the menu, what does it cost, can the shop make that many that day, and is there stock? */
voice.post("/tools/availability", async (c) => {
  const body = AvailabilityRequest.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: z.prettifyError(body.error) }, 400);

  const today = localDateOf(new Date(), business.timezone);
  const date = resolveSpokenDay(body.data.day, today);
  if (!date) return c.json({ say: `Sorry, which day did you mean?`, facts: [], items: [] });
  const dayName = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
  const hours = business.hours[weekdayOf(date)];
  const facts: string[] = [];
  if (!hours) {
    const next = await data.getNextOpenDays(date, 1);
    return c.json({
      say: `We're closed on ${dayName}.`,
      facts: [`Closed ${dayName} ${date}`, ...(next[0] ? [`Next open day: ${next[0].localDate}`] : [])],
      date,
      open: false,
      items: [],
    });
  }
  facts.push(`${dayName} ${date}: open ${hours.open} to ${hours.close}`);
  const nowLocal = new Intl.DateTimeFormat("en-GB", { timeZone: business.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
  if (date === today && nowLocal >= hours.close) {
    const next = await data.getNextOpenDays(date, 1);
    return c.json({
      say: `We've closed for today. We open again ${next[0] ? new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(new Date(`${next[0].localDate}T12:00:00Z`)) : "soon"}.`,
      facts: [...facts, `Closed for the rest of today (closes ${hours.close})`],
      date,
      open: false,
      items: [],
    });
  }

  const [catalog, load] = await Promise.all([data.getCatalog(), data.getDayLoad(date)]);
  const loadOf = (id: string) => load.find((l) => l.productId === id);
  const asked = body.data.items.length
    ? body.data.items.map((i) => ({ spoken: i.item, quantity: i.quantity ?? 1, product: findProduct(catalog, i.item) }))
    : catalog.map((p) => ({ spoken: p.name, quantity: 1, product: p as Product | null }));

  const known = asked.filter((a) => a.product);
  const needs = known.length
    ? await data.getIngredientNeeds(known.map((a) => ({ productId: a.product!.id, qty: a.quantity })), date)
    : [];
  const short = needs.filter((n) => n.shortfall > 0);
  const nextDays = await data.getNextOpenDays(date, 3);

  const items = asked.map((a) => {
    if (!a.product) return { asked: a.spoken, onMenu: false as const };
    const l = loadOf(a.product.id);
    const left = l ? Math.max(0, l.capacity - l.committed) : 0;
    const roomLater = nextDays
      .map((d) => {
        const dl = d.load.find((x) => x.productId === a.product!.id);
        return { date: d.localDate, left: dl ? Math.max(0, dl.capacity - dl.committed) : 0 };
      })
      .filter((d) => d.left > 0);
    return {
      asked: a.spoken,
      onMenu: true as const,
      productId: a.product.id,
      name: a.product.name,
      price: money(a.product.priceCents),
      size: productFacts[a.product.id]?.size ?? null,
      ingredients: productFacts[a.product.id]?.ingredients ?? [],
      allergens: productFacts[a.product.id]?.allergens ?? [],
      quantity: a.quantity,
      leftThatDay: left,
      fitsThatDay: left >= a.quantity,
      nextDaysWithRoom: roomLater,
    };
  });

  for (const i of items) {
    if (!i.onMenu) facts.push(`"${i.asked}" is not on the menu`);
    else {
      facts.push(`${i.name} ${i.price} each${i.size ? ` (${i.size})` : ""}; ${i.leftThatDay} more can be made ${dayName}${i.fitsThatDay ? "" : ` (asked for ${i.quantity})`}`);
      if (body.data.items.length) facts.push(`${i.name} contains: ${i.ingredients.join(", ")}. Allergens: ${i.allergens.length ? i.allergens.join(", ") : "none listed"}`);
    }
  }
  for (const n of short) facts.push(`Not enough ${n.name} in stock for that; a reorder from ${n.supplier} would be needed`);

  // One or two plain sentences for the phone; the agent may reword but not contradict the facts.
  const parts: string[] = [];
  const missing = items.filter((i) => !i.onMenu);
  if (missing.length) parts.push(`We don't have ${missing.map((m) => m.asked).join(" or ")} on the menu.`);
  type OnMenu = Extract<(typeof items)[number], { onMenu: true }>;
  const fits = items.filter((i): i is OnMenu => i.onMenu && i.fitsThatDay);
  const tight = items.filter((i): i is OnMenu => i.onMenu && !i.fitsThatDay);
  if (body.data.items.length) {
    if (fits.length) parts.push(`Yes, we can do ${fits.map((i) => (i.quantity > 1 ? `${i.quantity} ${plural(i.quantity, i.name.toLowerCase())}` : i.name.toLowerCase())).join(" and ")} on ${dayName}.`);
    for (const t of tight) {
      const later = t.nextDaysWithRoom[0];
      parts.push(
        t.leftThatDay > 0
          ? `We only have room for ${t.leftThatDay} more ${plural(t.leftThatDay, t.name.toLowerCase())} on ${dayName}${later ? `, and more on ${new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(new Date(`${later.date}T12:00:00Z`))}` : ""}.`
          : `${t.name} is sold out for ${dayName}.`,
      );
    }
    if (short.length && fits.length) parts.push(`I'll flag it for the owner, since we may need to restock for that.`);
  } else {
    const avail = items.filter((i) => i.onMenu && i.leftThatDay > 0).map((i) => (i.onMenu ? i.name.toLowerCase() : ""));
    parts.push(avail.length ? `On ${dayName} we have ${avail.slice(0, 8).join(", ")}.` : `We're fully booked on ${dayName}.`);
  }

  await logEvent("agent:intake", "agent.step", null, {
    agent: "intake",
    step: "voice_availability",
    ms: 0,
    summary: parts.join(" ").slice(0, 200),
    reads: known.map((k) => ({ table: "products", id: k.product!.id })),
    flags: short.length ? ["ingredient_shortfall"] : [],
  });
  return c.json({ say: parts.join(" "), facts, date, open: true, items, stockShort: short.map((n) => ({ ingredient: n.name, supplier: n.supplier })) });
});

/** The caller's order: runs the same pipeline as a text and puts a ticket on the pass for the owner. */
voice.post("/tools/order", async (c) => {
  const parsed = VoiceToolRequest.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: z.prettifyError(parsed.error) }, 400);

  let thread: { conversationId: string; messageId: string } | null = null;
  const { ctx, flush } = agentContext(null);
  const { response, drafts } = await handleVoiceTurn(parsed.data, ctx, async (input) => {
    // Voice rides on the 'simulated' platform until a migration adds 'voice'; the handle carries the caller.
    thread = await ingestInbound({ platform: "simulated", handle: input.handle, name: input.name, text: input.text, runAgents: false, voice: true });
    if (!thread) throw new Error("Could not store the caller's message");
    await linkCall(input.callId, thread.conversationId);
    return thread;
  });
  await flush();

  const t = thread as { conversationId: string; messageId: string } | null;
  const ids = t ? await storeDrafts(drafts, t.conversationId, t.messageId) : [];
  const stored = ids.filter((id): id is string => Boolean(id));
  const { data: codes } = stored.length ? await db().from("proposals").select("short_code").in("id", stored) : { data: [] };
  return c.json({ ...response, proposalIds: (codes ?? []).map((p) => p.short_code).filter(Boolean) });
});
