/**
 * The understand step: one message in, structured data out.
 *
 * Two paths produce the same shape. The model path handles the long tail — typos,
 * Spanish, rambling messages with an order buried in them. The deterministic path
 * handles the demo-critical cases with no model at all, so `handleInbound` still
 * returns real drafts when no key is configured, the gateway is down, or the venue
 * network has given up. The pipeline always has somewhere to go.
 */
import { z } from "zod";
import type { Product } from "@boh/shared";
import { addDays, nextSaturdayAndSunday, nextWeekday, type WeekdayKey } from "./time.ts";
import { Budget, generateStructured, isModelConfigured } from "./model.ts";
import { UNDERSTAND_SYSTEM, understandPrompt } from "./prompts/understand.ts";

export const Intent = z.enum([
  "order_new",
  "order_usual",
  "order_change",
  "catering",
  "question_hours",
  "question_menu",
  "question_order_status",
  "complaint",
  "smalltalk",
  "other",
]);

export const Understanding = z.object({
  intent: Intent,
  items: z.array(z.object({ productId: z.string(), qty: z.number().int().positive() })),
  /** "YYYY-MM-DDTHH:mm" in the business timezone, or null when no time was named. */
  pickupLocal: z.string().nullable(),
  mentionsAllergy: z.boolean(),
  injectionSuspected: z.boolean(),
  offPolicyAsk: z.boolean(),
  abusive: z.boolean(),
  offTopic: z.boolean(),
  needsClarification: z.boolean(),
  clarifyingQuestion: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

export type Understanding = z.infer<typeof Understanding>;

export interface UnderstandInput {
  text: string;
  catalog: Product[];
  todayLocal: string;
  timezone: string;
  nowLocal: string;
  customerName?: string;
  recentTurns?: { direction: "inbound" | "outbound"; body: string }[];
}

export interface UnderstandResult {
  value: Understanding;
  source: "model" | "deterministic";
  ms: number;
  /**
   * Why the model path was not used. Silently degrading to keywords is the dangerous
   * failure: everything keeps working, a little worse, and nobody notices for hours.
   * The trace carries this so a dashboard can show "read without the model: <reason>".
   */
  fallbackReason?: string;
}

export async function understand(input: UnderstandInput, budget: Budget): Promise<UnderstandResult> {
  let fallbackReason: string | undefined;

  if (!isModelConfigured()) {
    fallbackReason = "no model key configured";
  } else if (budget.exhausted()) {
    fallbackReason = "time budget spent before the call";
  } else {
    try {
      const result = await generateStructured({
        schema: Understanding,
        system: UNDERSTAND_SYSTEM,
        prompt: understandPrompt(input),
        temperature: 0.2,
        budget,
        step: "understand",
      });
      return { value: sanitize(result.value, input), source: "model", ms: result.ms };
    } catch (error) {
      fallbackReason = error instanceof Error ? error.message : String(error);
    }
  }

  const startedAt = Date.now();
  return {
    value: understandDeterministically(input),
    source: "deterministic",
    ms: Date.now() - startedAt,
    fallbackReason,
  };
}

/**
 * Drops anything the model invented. Unknown product ids are the common case, and
 * silently keeping one would put an item on a ticket that the shop does not sell.
 */
function sanitize(value: Understanding, input: UnderstandInput): Understanding {
  const known = new Set(input.catalog.map((p) => p.id));
  const items = value.items.filter((i) => known.has(i.productId));
  const dropped = items.length !== value.items.length;

  // Models disagree about which date "Saturday" means when today is a Saturday. The day a
  // message names is a rule, not a judgment, so the rule decides the date; the model keeps the time.
  let pickupLocal = normalizeLocalDateTime(value.pickupLocal);
  const namedDay = dayFromText(input.text, input.todayLocal, input.timezone);
  if (pickupLocal && namedDay && pickupLocal.slice(0, 10) !== namedDay) pickupLocal = `${namedDay}${pickupLocal.slice(10)}`;

  // "🥐🥐☕️ sat?" is a real order that a model will often return no items for, and the
  // alias table already knows what those glyphs mean. Only ever fills an empty list.
  const withEmoji = items.length === 0 ? matchItems(input.text, input.catalog) : items;

  return {
    ...value,
    items: withEmoji,
    pickupLocal,
    needsClarification: value.needsClarification || dropped,
    confidence: dropped ? Math.min(value.confidence, 0.5) : value.confidence,
  };
}

/**
 * Accepts the shapes a model actually returns and trims them to minutes.
 *
 * Rejecting anything but exactly "YYYY-MM-DDTHH:mm" looks strict and safe, but the
 * failure is silent and expensive: a model that answers "2026-10-24T09:00:00" loses its
 * pickup time, which means no order, which means no counteroffer. Normalize what is
 * unambiguous, reject what is not.
 */
export function normalizeLocalDateTime(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi] = match as unknown as [string, string, string, string, string, string];
  const hour = Number(h);
  const minute = Number(mi);
  if (hour > 23 || minute > 59) return null;
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${y}-${mo}-${d}T${String(hour).padStart(2, "0")}:${mi}`;
}

// ---------------------------------------------------------------------------
// Deterministic reading
// ---------------------------------------------------------------------------

const WORD_NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  couple: 2, few: 3,
};

const WEEKDAY_WORDS: Record<string, WeekdayKey> = {
  sunday: "sun", sun: "sun", monday: "mon", mon: "mon", tuesday: "tue", tue: "tue", tues: "tue",
  wednesday: "wed", wed: "wed", thursday: "thu", thu: "thu", thurs: "thu",
  friday: "fri", fri: "fri", saturday: "sat", sat: "sat",
};

const ALLERGY_WORDS = /\b(allerg(y|ic|ies)|anaphyla|celiac|coeliac|intoleran(t|ce))\b/i;
const HOURS_WORDS = /\b(open|close|closing|closed|hours|what\s+time)\b/i;
const MENU_WORDS = /\b(menu|do\s+you\s+(have|sell|make|carry)|gluten\s*free|vegan|dairy\s*free|what\s+(do\s+you|kind))\b/i;
const PRICE_WORDS = /\b(how\s+much|price|cost)\b/i;
const STATUS_WORDS = /\b(my\s+order|order\s+status|is\s+(it|my\s+order)\s+ready|pick\s*up\s+time)\b/i;
const COMPLAINT_WORDS = /\b(wrong|stale|burnt|cold|rude|upset|disappoint|refund|complain|awful|terrible)\b/i;
const CHANGE_WORDS = /\b(actually|instead|change|make\s+it|cancel|add\s+(a|one|another)|same\s+as\s+last)\b/i;
const USUAL_WORDS = /\b(the\s+usual|my\s+usual|usual\b|same\s+as\s+(last|always)|regular\s+order)\b/i;
const SMALLTALK_WORDS = /^\s*(thanks?|thank\s+you|thx|ty|cool|great|awesome|perfect|ok|okay|sounds\s+good|👍|🙏)[\s!.…]*$/i;
const DELIVERY_WORDS = /\b(deliver|delivery|doordash|uber\s*eats|ship)\b/i;
const OFF_TOPIC_WORDS = /\b(what'?s\s+\d+\s*[+\-*/]\s*\d+|weather|capital\s+of|who\s+won|tell\s+me\s+a\s+joke)\b/i;
const ABUSIVE_WORDS = /\b(fuck|shit|bitch|asshole|idiot|stupid\s+(coffee house|caf[eé]|coffee\s+shop|shop)|moron)\b/i;

/** Emoji the demo personas actually use. "🥐🥐☕️ sat?" has to resolve to something. */
const EMOJI_PRODUCTS: Record<string, string> = {
  "🥐": "milk-cake",
  "☕": "qishr",
  "🧋": "cold-brew",
  "🍫": "mokha-latte",
  "🧁": "sabaya",
};

/** Quantity immediately before a product mention: "4 dozen", "two", "a couple of", "48". */
function quantityBefore(text: string, matchStart: number): number | null {
  const window = text.slice(Math.max(0, matchStart - 28), matchStart).toLowerCase();

  const dozen = /(\d+|a|one|two|three|four|five|six|half(?:\s+a)?)\s*(?:-|\s)?dozen\b[^a-z0-9]*$/.exec(window);
  if (dozen) {
    const raw = dozen[1] as string;
    if (raw.startsWith("half")) return 6;
    const count = Number(raw) || WORD_NUMBERS[raw] || 1;
    return count * 12;
  }

  const digits = /(\d{1,3})\s*(?:x|\*)?\s*[^a-z0-9]*$/.exec(window);
  if (digits) return Number(digits[1]);

  const words = /\b(a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|couple|few)\s+(?:of\s+)?[^a-z0-9]*$/.exec(window);
  if (words) return WORD_NUMBERS[words[1] as string] ?? 1;

  return null;
}

/** The day a message names ("tomorrow", "Saturday"), by the same rule everywhere. Null when it names none. */
export function dayFromText(text: string, todayLocal: string, timezone: string): string | null {
  const lower = text.toLowerCase();
  if (/\btomorrow\b/.test(lower)) return addDays(todayLocal, 1);
  if (/\btoday\b|\bthis\s+(morning|afternoon)\b/.test(lower)) return todayLocal;
  // The weekend of the counteroffer: "Saturday" is the next one, "Sunday" the day after it.
  const weekend = nextSaturdayAndSunday(todayLocal, timezone);
  const weekdayHit = /\b(sunday|sun|monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thu|friday|fri|saturday|sat)\b/.exec(lower);
  if (!weekdayHit) return null;
  const key = WEEKDAY_WORDS[weekdayHit[1] as string] as WeekdayKey;
  return key === "sat" ? weekend.sat : key === "sun" ? weekend.sun : nextWeekday(todayLocal, key, timezone);
}

/** Resolves a day and time from the message, in the business timezone. */
function resolvePickup(text: string, todayLocal: string, timezone: string): string | null {
  const lower = text.toLowerCase();
  const date = dayFromText(text, todayLocal, timezone);

  const explicit = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/.exec(lower) ?? /\bat\s+(\d{1,2})(?::(\d{2}))?\b/.exec(lower);
  let time: string | null = null;
  if (explicit) {
    let hour = Number(explicit[1]);
    const minute = explicit[2] ?? "00";
    const meridiem = explicit[3];
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    // No am/pm on a coffee house order means the morning, unless that would be before opening.
    if (!meridiem && hour < 7) hour += 12;
    time = `${String(hour).padStart(2, "0")}:${minute}`;
  } else if (/\bmorning\b/.test(lower)) time = "09:00";
  else if (/\bafternoon\b/.test(lower)) time = "13:00";
  else if (/\bnoon\b|\blunch\b/.test(lower)) time = "12:00";

  if (!date && !time) return null;
  return `${date ?? todayLocal}T${time ?? "09:00"}`;
}

/**
 * Longest alias first, so "pistachio maamoul" wins over "milk cake".
 *
 * Exported because the deterministic reading is useful even on the model path: it
 * answers "which product is this question about?" for a price query, and it catches
 * emoji the model does not map.
 */
export function matchItems(text: string, catalog: Product[]): { productId: string; qty: number }[] {
  const labels: { productId: string; label: string }[] = [];
  for (const product of catalog) {
    for (const label of [product.name, ...product.aliases]) {
      labels.push({ productId: product.id, label: label.toLowerCase() });
    }
  }
  labels.sort((a, b) => b.label.length - a.label.length);

  let remaining = text.toLowerCase();
  const found = new Map<string, number>();

  for (const { productId, label } of labels) {
    const pattern = new RegExp(`\\b${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?\\b`, "g");
    for (const match of [...remaining.matchAll(pattern)]) {
      const qty = quantityBefore(remaining, match.index) ?? 1;
      found.set(productId, (found.get(productId) ?? 0) + qty);
      // Blank the span so a shorter alias cannot claim the same words.
      remaining = `${remaining.slice(0, match.index)}${" ".repeat(match[0].length)}${remaining.slice(match.index + match[0].length)}`;
    }
  }

  for (const [emoji, productId] of Object.entries(EMOJI_PRODUCTS)) {
    const count = [...text].filter((c) => c === emoji).length;
    if (count > 0 && !found.has(productId)) found.set(productId, count);
  }

  return [...found].map(([productId, qty]) => ({ productId, qty }));
}

export function understandDeterministically(input: UnderstandInput): Understanding {
  const { text, catalog, todayLocal, timezone } = input;

  const items = matchItems(text, catalog);
  const pickupLocal = resolvePickup(text, todayLocal, timezone);
  const wantsUsual = USUAL_WORDS.test(text);

  const abusive = ABUSIVE_WORDS.test(text);
  const offTopic = !abusive && items.length === 0 && OFF_TOPIC_WORDS.test(text);

  let intent: z.infer<typeof Intent>;
  if (wantsUsual) intent = "order_usual";
  else if (COMPLAINT_WORDS.test(text) && items.length === 0) intent = "complaint";
  else if (STATUS_WORDS.test(text)) intent = "question_order_status";
  else if (HOURS_WORDS.test(text) && items.length === 0) intent = "question_hours";
  else if ((MENU_WORDS.test(text) || PRICE_WORDS.test(text) || DELIVERY_WORDS.test(text)) && !pickupLocal)
    intent = "question_menu";
  else if (items.length > 0 && CHANGE_WORDS.test(text)) intent = "order_change";
  else if (items.length > 0) {
    const units = items.reduce((sum, i) => sum + i.qty, 0);
    intent = units >= 24 ? "catering" : "order_new";
  } else if (SMALLTALK_WORDS.test(text)) intent = "smalltalk";
  else if (offTopic || abusive) intent = "other";
  else intent = "other";

  const needsClarification =
    (intent === "order_new" || intent === "order_change" || intent === "catering") && items.length === 0;

  // Deliberately not confident: this path guesses from keywords, and the ticket should
  // say so rather than present a keyword match as understanding.
  const confidence = items.length > 0 || wantsUsual ? 0.62 : intent === "other" ? 0.4 : 0.55;

  return {
    intent,
    items,
    pickupLocal,
    mentionsAllergy: ALLERGY_WORDS.test(text),
    // Pattern-based input flags live in guard.ts; checkInbound folds them in either way.
    injectionSuspected: false,
    offPolicyAsk: false,
    abusive,
    offTopic,
    needsClarification,
    clarifyingQuestion: needsClarification ? "Happy to help — which items and how many?" : null,
    confidence,
  };
}
