/**
 * The only place in this package that talks to a model.
 *
 * Two calls run per inbound message (understand, then draft), inside a pipeline whose
 * whole budget is a few seconds, so every call is bounded: a per-call timeout, one
 * retry on a parse failure, and a shared deadline that stops the pipeline from
 * spending its budget on a retry it cannot afford.
 *
 * Checked against the installed AI SDK: `ai` 7.0.143 still exports `generateObject` but
 * warns that it is deprecated in favour of `generateText` with an `output` setting, so
 * this file uses `generateText` + `Output.object`.
 *
 * A bare model id string routes through the Vercel AI Gateway using
 * `AI_GATEWAY_API_KEY`. With no key configured, `isModelConfigured()` is false and the
 * pipeline takes its deterministic path instead of throwing.
 */
import { Output, generateText } from "ai";
import type { z } from "zod";

/**
 * Verified working on the gateway's free tier (about 1.1s per structured call).
 *
 * Two things to know before changing this. The gateway spells Anthropic ids with
 * **dots**, not dashes: `anthropic/claude-haiku-4.5`, and a dashed id comes back as a
 * 403 whose message says "free tier users do not have access to this model", which
 * reads like a billing problem rather than a typo. And every `anthropic/*` id really
 * is blocked without paid credits, so this default has to be something that works out
 * of the box.
 *
 * Top up credits and `anthropic/claude-haiku-4.5` is the better choice — the Guard's
 * injection calls and the shop-voice drafting are both judged, and both reward a
 * stronger model. Record the swap in docs/DECISIONS.md.
 */
export const DEFAULT_MODEL = "google/gemini-2.5-flash-lite";

export const PER_CALL_TIMEOUT_MS = 6_000;
/** The whole pipeline's model budget. Leaves room for the data loads and the guard. */
export const PIPELINE_BUDGET_MS = 9_000;

export function modelId(): string {
  return process.env.AGENT_MODEL?.trim() || DEFAULT_MODEL;
}

/** False when no gateway or provider key is present, so callers can skip the model entirely. */
export function isModelConfigured(): boolean {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.AGENT_MODEL_API_KEY,
  );
}

export class ModelUnavailableError extends Error {
  constructor(reason: string) {
    super(`model unavailable: ${reason}`);
    this.name = "ModelUnavailableError";
  }
}

/** Tracks the pipeline's shared deadline across both calls. */
export class Budget {
  private readonly deadline: number;

  constructor(totalMs: number = PIPELINE_BUDGET_MS, now: number = Date.now()) {
    this.deadline = now + totalMs;
  }

  remainingMs(): number {
    return Math.max(0, this.deadline - Date.now());
  }

  /** How long a single call may take: whichever is smaller, the per-call cap or what's left. */
  sliceMs(cap: number = PER_CALL_TIMEOUT_MS): number {
    return Math.min(cap, this.remainingMs());
  }

  /** True when there is not enough time left to be worth another model call. */
  exhausted(minimumMs = 1_200): boolean {
    return this.remainingMs() < minimumMs;
  }
}

export interface StructuredCall<T extends z.ZodType> {
  schema: T;
  system: string;
  prompt: string;
  temperature: number;
  budget: Budget;
  /** Label for error messages and the trace. */
  step: string;
  /** Off for the second attempt, so a retry never loops. */
  retryOnParseFailure?: boolean;
}

export interface StructuredResult<T> {
  value: T;
  ms: number;
  attempts: number;
}

/**
 * One structured-output call, bounded and retried once on a parse failure.
 *
 * A parse failure is worth retrying because it is usually the model emitting prose
 * around the JSON. A timeout is not: the budget is already gone, and the caller has a
 * deterministic fallback.
 */
export async function generateStructured<T extends z.ZodType>(
  call: StructuredCall<T>,
): Promise<StructuredResult<z.infer<T>>> {
  if (!isModelConfigured()) {
    throw new ModelUnavailableError("no AI_GATEWAY_API_KEY or provider key in the environment");
  }
  if (call.budget.exhausted()) {
    throw new ModelUnavailableError(`${call.step}: pipeline budget spent before the call`);
  }

  const maxAttempts = call.retryOnParseFailure === false ? 1 : 2;
  const startedAt = Date.now();
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const slice = call.budget.sliceMs();
    if (slice < 500) break;

    try {
      const { output } = await generateText({
        model: modelId(),
        output: Output.object({ schema: call.schema }),
        system: call.system,
        prompt: call.prompt,
        temperature: call.temperature,
        abortSignal: AbortSignal.timeout(slice),
      });
      return { value: output as z.infer<T>, ms: Date.now() - startedAt, attempts: attempt };
    } catch (error) {
      lastError = error;
      // Out of time, or aborted: a retry cannot help.
      if (isTimeout(error) || call.budget.exhausted()) break;
    }
  }

  throw new ModelUnavailableError(
    `${call.step} failed after ${Date.now() - startedAt}ms: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

function isTimeout(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === "AbortError" || error.name === "TimeoutError" || /abort|timeout/i.test(error.message);
}
