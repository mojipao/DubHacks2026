/**
 * `@boh/agents` — the brain behind the counter.
 *
 * The server's only entry point is `handleInbound`: it hands over a read-only data
 * port and gets back proposals. Nothing in this package writes to the database, sends
 * a message, charges a card, or prices an order. That is the whole trust story, and it
 * is enforced by the fact that there is no client in here to do it with.
 */
export { handleInbound } from "./intake.ts";
export { runWinbackScan } from "./winback.ts";

// Deterministic pieces worth reusing and testing on their own.
export { planFulfillment, planReorder, aggregateNeeds, lastOpenDayBefore } from "./ops.ts";
export type { FulfillmentPlan, PlannedDay, PlannedReorder } from "./ops.ts";
export { checkReply, checkInbound, MAX_REPLY_CHARS } from "./guard.ts";
export type { GuardFacts, GuardResult } from "./guard.ts";
export { computeUsual, daysSinceLastOrder } from "./usual.ts";
export type { Usual } from "./usual.ts";
export { understand, understandDeterministically, Understanding } from "./understand.ts";
export { recordReads } from "./reads.ts";
export type { RecordingPort } from "./reads.ts";
export { DEFAULT_MODEL, modelId, isModelConfigured, Budget } from "./model.ts";

// Fixtures, so the server's own tests and the eval harness can run without Supabase.
export { createFixtureWorld } from "./fixtures/fixture-port.ts";
export type { FixtureWorld, FixturePortOptions } from "./fixtures/fixture-port.ts";

export * as time from "./time.ts";
