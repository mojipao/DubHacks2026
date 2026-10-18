/**
 * Runs `data/evals/inbound.jsonl` through the real pipeline and prints a scoreboard.
 *
 *   pnpm --filter @boh/agents eval
 *   pnpm --filter @boh/agents eval -- --once            # 1 run per case, for a fast loop
 *   pnpm --filter @boh/agents eval -- --filter=judge    # only cases whose id matches
 *   pnpm --filter @boh/agents eval -- --verbose         # print every reply
 *
 * Each case runs three times and only counts as passing if all three pass, because a
 * model that gets a case right two times in three is not something to demo. Exits
 * non-zero below 90%, so it can gate a PR.
 *
 * It paces itself. Firing every case back to back is roughly 68 model calls in two
 * minutes, which trips the gateway's free-tier rate limit; every call then returns 429,
 * the pipeline falls back to the deterministic reader, and the run reports a healthy
 * score for a model that never answered. Demo traffic is nothing like that — about one
 * message every 20-30 seconds — so the harness waits between cases rather than
 * measuring a self-inflicted outage. `--fast` removes the gap when the model is off.
 *
 * Paste the table into the PR description. The point is not a number; it is knowing
 * which specific cases are still wrong before a judge finds them.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import type { AgentContext, ProposalDraft } from "@boh/shared";
import { PAYMENT_LINK_TOKEN } from "@boh/shared";
import { createFixtureWorld } from "./fixtures/fixture-port.ts";
import { handleInbound } from "./intake.ts";
import { runWinbackScan } from "./winback.ts";
import { isModelConfigured, modelId } from "./model.ts";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });

/** Synthetic handles. Real numbers live in DEMO_PERSONAS and never reach this file. */
const HANDLES: Record<string, string> = {
  maya: "+12065550100",
  jun: "+12065550101",
  priya: "+12065550102",
  elena: "+12065550103",
  new: "+12065559999",
};

const DEFAULT_NOW = "2026-10-17T12:00:00-07:00";

interface Expect {
  intent?: string;
  items?: { productId: string; qty: number }[];
  hasOrder?: boolean;
  orderCount?: number;
  splitQtys?: number[];
  hasReorder?: boolean;
  reorderSupplier?: string;
  hasPaymentLink?: boolean;
  flagsInclude?: string[];
  flagsExclude?: string[];
  mustMatch?: string;
  mustNotMatch?: string;
  maxChars?: number;
  topCandidateName?: string;
  excludesName?: string;
}

interface EvalCase {
  id: string;
  kind: "inbound" | "winback";
  as?: string;
  now?: string;
  history?: string[];
  text?: string;
  expect: Expect;
}

const args = process.argv.slice(2);
const flag = (name: string): string | undefined =>
  args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const RUNS = args.includes("--once") ? 1 : Number(flag("runs") ?? 3);
/** Gap between cases. Enough to stay under the free tier's per-minute cap. */
const PACE_MS = args.includes("--fast") ? 0 : Number(flag("pace") ?? 1_500);
const FILTER = flag("filter");
const VERBOSE = args.includes("--verbose");

const cases: EvalCase[] = readFileSync(fileURLToPath(new URL("../../../data/evals/inbound.jsonl", import.meta.url)), "utf8")
  .split("\n")
  .filter((line) => line.trim().length > 0)
  .map((line) => JSON.parse(line) as EvalCase)
  .filter((c) => !FILTER || c.id.includes(FILTER));

interface Attempt {
  failures: string[];
  ms: number;
  reply: string;
  drafts: ProposalDraft[];
  usedModel: boolean;
}

async function runOnce(testCase: EvalCase): Promise<Attempt> {
  const now = new Date(testCase.now ?? DEFAULT_NOW);
  const handle = HANDLES[testCase.as ?? "new"] ?? HANDLES.new as string;
  const steps: { step: string; detail: Record<string, unknown> }[] = [];

  // Prior turns matter for the "actually make it 3" and "thanks!!" cases.
  const messages = [
    ...(testCase.history ?? []).map((body, index) => ({
      id: `h${index}`,
      direction: "inbound" as const,
      body,
      createdAt: now.toISOString(),
    })),
    { id: "msg-target", direction: "inbound" as const, body: testCase.text ?? "", createdAt: now.toISOString() },
  ];

  const world = createFixtureWorld({
    now,
    handles: Object.fromEntries(Object.entries(HANDLES).filter(([key]) => key === testCase.as)),
    conversation: { id: "eval", handle, customerId: null, messages },
  });

  const ctx: AgentContext = {
    data: world.port,
    business: world.business,
    now: () => now,
    trace: (step, detail) => steps.push({ step, detail }),
  };

  const startedAt = Date.now();
  const drafts =
    testCase.kind === "winback"
      ? await runWinbackScan(ctx)
      : await handleInbound({ conversationId: "eval", messageId: "msg-target" }, ctx);
  const ms = Date.now() - startedAt;

  const understand = steps.find((s) => s.step === "understand");
  const usedModel = understand?.detail.source === "model";
  // The pipeline reports intent through the trace, not on the draft.
  const intent = String(understand?.detail.summary ?? "").split(/[,\s]/)[0] ?? "";

  return { failures: check(testCase, drafts, intent, world), ms, reply: replyTextOf(drafts), drafts, usedModel };
}

const replyTextOf = (drafts: ProposalDraft[]): string => {
  const reply = drafts.find((d) => d.kind === "reply");
  return reply?.kind === "reply" ? reply.payload.text : "";
};

function check(
  testCase: EvalCase,
  drafts: ProposalDraft[],
  intent: string,
  world: ReturnType<typeof createFixtureWorld>,
): string[] {
  const e = testCase.expect;
  const failures: string[] = [];
  const reply = drafts.find((d) => d.kind === "reply");
  const replyDraft = reply?.kind === "reply" ? reply : null;
  const text = replyDraft?.payload.text ?? "";
  const orders = replyDraft?.payload.orders ?? [];
  const flags = new Set(drafts.flatMap((d) => d.riskFlags));

  if (testCase.kind === "winback") {
    if (e.topCandidateName) {
      const named = drafts.some((d) => d.title.includes(e.topCandidateName!.split(" ")[0] as string));
      if (!named) failures.push(`top candidate is not ${e.topCandidateName} (got "${drafts[0]?.title ?? "nothing"}")`);
    }
    if (e.excludesName) {
      const first = e.excludesName.split(" ")[0] as string;
      if (drafts.some((d) => d.title.includes(first) || d.payload && JSON.stringify(d.payload).includes(first))) {
        failures.push(`${e.excludesName} should be excluded but appears in a draft`);
      }
    }
  }

  if (e.intent !== undefined && intent !== e.intent) failures.push(`intent ${intent || "(none)"} != ${e.intent}`);

  if (e.hasOrder !== undefined) {
    const has = orders.length > 0;
    if (has !== e.hasOrder) failures.push(`hasOrder ${has} != ${e.hasOrder}`);
  }
  if (e.orderCount !== undefined && orders.length !== e.orderCount) {
    failures.push(`orderCount ${orders.length} != ${e.orderCount}`);
  }
  if (e.splitQtys) {
    const got = orders.map((o) => o.items.reduce((s, i) => s + i.qty, 0));
    if (JSON.stringify(got) !== JSON.stringify(e.splitQtys)) {
      failures.push(`split ${JSON.stringify(got)} != ${JSON.stringify(e.splitQtys)}`);
    }
  }
  if (e.items) {
    const got = orders.flatMap((o) => o.items);
    for (const want of e.items) {
      const total = got.filter((i) => i.productId === want.productId).reduce((s, i) => s + i.qty, 0);
      if (total !== want.qty) failures.push(`${want.productId} qty ${total} != ${want.qty}`);
    }
  }
  if (e.hasReorder !== undefined) {
    const has = drafts.some((d) => d.kind === "reorder");
    if (has !== e.hasReorder) failures.push(`hasReorder ${has} != ${e.hasReorder}`);
  }
  if (e.reorderSupplier) {
    const reorder = drafts.find((d) => d.kind === "reorder");
    const supplier = reorder?.kind === "reorder" ? reorder.payload.supplier : "(none)";
    if (supplier !== e.reorderSupplier) failures.push(`reorder supplier ${supplier} != ${e.reorderSupplier}`);
  }
  if (e.hasPaymentLink !== undefined) {
    const count = text.split(PAYMENT_LINK_TOKEN).length - 1;
    if ((count === 1) !== e.hasPaymentLink) failures.push(`payment link x${count}, expected ${e.hasPaymentLink ? 1 : 0}`);
  }
  for (const want of e.flagsInclude ?? []) {
    if (!flags.has(want as never)) failures.push(`missing flag ${want}`);
  }
  for (const unwanted of e.flagsExclude ?? []) {
    if (flags.has(unwanted as never)) failures.push(`unexpected flag ${unwanted}`);
  }
  if (e.mustMatch && !new RegExp(e.mustMatch, "i").test(text)) failures.push(`reply does not match /${e.mustMatch}/`);
  if (e.mustNotMatch && new RegExp(e.mustNotMatch, "i").test(text)) failures.push(`reply matches /${e.mustNotMatch}/`);
  if (e.maxChars !== undefined && text.length > e.maxChars) failures.push(`reply ${text.length} chars > ${e.maxChars}`);

  // Universal invariants: these hold for every case, stated or not.
  if (text.length > 480) failures.push(`reply ${text.length} chars exceeds the hard 480 cap`);
  if (/\b(system prompt|my instructions|as an AI|language model)\b/i.test(text)) {
    failures.push("reply discusses its own machinery");
  }
  if (orders.length > 2) failures.push(`${orders.length} orders exceeds the contract's max of 2`);
  for (const order of orders) {
    for (const item of order.items) {
      if (!world.products.some((p) => p.id === item.productId)) failures.push(`unknown product ${item.productId}`);
    }
  }

  return failures;
}

async function main(): Promise<void> {
  const mode = isModelConfigured() ? `model ${modelId()}` : "deterministic (no model key)";
  console.log(`\n  Back of House evals · ${cases.length} cases · ${RUNS} run${RUNS === 1 ? "" : "s"} each · ${mode}\n`);

  let passed = 0;
  let modelRuns = 0;
  let totalRuns = 0;
  const rows: string[] = [];
  const failedDetail: string[] = [];

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  for (const [index, testCase] of cases.entries()) {
    const attempts: Attempt[] = [];
    for (let i = 0; i < RUNS; i++) {
      if (PACE_MS > 0 && (index > 0 || i > 0) && isModelConfigured()) await sleep(PACE_MS);
      attempts.push(await runOnce(testCase));
    }

    modelRuns += attempts.filter((a) => a.usedModel).length;
    totalRuns += attempts.length;
    const clean = attempts.filter((a) => a.failures.length === 0).length;
    const ok = clean === RUNS;
    if (ok) passed++;

    const avgMs = Math.round(attempts.reduce((s, a) => s + a.ms, 0) / attempts.length);
    const stability = RUNS > 1 ? ` ${clean}/${RUNS}` : "";
    const worst = attempts.find((a) => a.failures.length > 0);

    rows.push(
      `  ${ok ? "✓" : "✗"} ${testCase.id.padEnd(30)} ${String(avgMs).padStart(6)}ms${stability.padEnd(5)} ${
        ok ? "" : (worst?.failures[0] ?? "")
      }`,
    );

    if (!ok && worst) {
      failedDetail.push(`  ${testCase.id}`);
      for (const failure of [...new Set(attempts.flatMap((a) => a.failures))]) failedDetail.push(`      - ${failure}`);
      failedDetail.push(`      reply: ${JSON.stringify(worst.reply.slice(0, 140))}`);
    }
    if (VERBOSE) rows.push(`      reply: ${JSON.stringify(attempts[0]?.reply.slice(0, 160) ?? "")}`);
  }

  for (const row of rows) console.log(row);

  const rate = (passed / cases.length) * 100;
  const modelShare = totalRuns === 0 ? 0 : (modelRuns / totalRuns) * 100;
  console.log(`\n  ${passed}/${cases.length} cases pass — ${rate.toFixed(1)}%`);
  // A model that times out on every call still scores well here, because the
  // deterministic reader catches it. That is a fallback score, not a model score.
  console.log(`  the model answered on ${modelRuns}/${totalRuns} runs (${modelShare.toFixed(0)}%)\n`);
  if (isModelConfigured() && modelShare < 50) {
    console.log(`  ! ${modelId()} answered under half the time — most of this score is the deterministic path.\n`);
  }

  if (failedDetail.length > 0) {
    console.log("  failures in detail:");
    for (const line of failedDetail) console.log(line);
    console.log("");
  }

  if (rate < 90) {
    console.error(`  below the 90% gate\n`);
    process.exit(1);
  }
}

await main();
