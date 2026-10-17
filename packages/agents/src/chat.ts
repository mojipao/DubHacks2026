/**
 * Talk to the agents as a persona, with no server and no database.
 *
 *   pnpm --filter @boh/agents chat -- --as maya
 *   pnpm --filter @boh/agents chat -- --as jun --now 2026-10-17T12:00:00-07:00
 *
 * Prints the drafts, their flags, the evidence, and the trace with timings, which is
 * the fastest way to see what a wording change does to the pipeline.
 */
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import type { AgentContext, ConversationContext, ProposalDraft } from "@boh/shared";
import { createFixtureWorld } from "./fixtures/fixture-port.ts";
import { handleInbound } from "./intake.ts";
import { isModelConfigured, modelId } from "./model.ts";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });

const arg = (flag: string): string | undefined =>
  process.argv.slice(2).find((a) => a.startsWith(`${flag}=`))?.slice(flag.length + 1) ??
  (process.argv[process.argv.indexOf(flag) + 1]?.startsWith("--") ? undefined : process.argv[process.argv.indexOf(flag) + 1]);

const persona = arg("--as") ?? "maya";
const now = new Date(arg("--now") ?? Date.now());

/** Synthetic handles only; real numbers live in DEMO_PERSONAS and never reach this file. */
const HANDLES: Record<string, string> = {
  maya: "+12065550100",
  jun: "+12065550101",
  priya: "+12065550102",
  elena: "+12065550103",
  judge: "+12065550199",
};

const handle = HANDLES[persona] ?? HANDLES.judge as string;

function render(drafts: ProposalDraft[], steps: { step: string; detail: Record<string, unknown> }[]): void {
  for (const [index, draft] of drafts.entries()) {
    const linked = draft.parentIndex !== undefined ? ` (linked to #${draft.parentIndex + 1})` : "";
    console.log(`\n  ── #${index + 1} ${draft.kind.toUpperCase()} · ${draft.agent}${linked}`);
    console.log(`     ${draft.title}`);
    console.log(`     ${draft.summary}`);
    console.log(`     why: ${draft.rationale}`);
    console.log(`     confidence ${draft.confidence}${draft.riskFlags.length ? ` · flags: ${draft.riskFlags.join(", ")}` : ""}`);

    if (draft.kind === "reply") {
      console.log(`\n     "${draft.payload.text}"`);
      for (const [n, order] of draft.payload.orders.entries()) {
        const items = order.items.map((i) => `${i.qty}x ${i.productId}`).join(", ");
        console.log(`     order ${n + 1}: ${items} @ ${order.pickupAt}${order.perk ? ` · ${order.perk}` : ""}`);
      }
    } else {
      const lines = draft.payload.lines.map((l) => `${l.qty} ${l.ingredientId}`).join(", ");
      console.log(`     ${draft.payload.supplier}: ${lines}${draft.payload.neededBy ? ` by ${draft.payload.neededBy}` : ""}`);
    }

    if (draft.evidence.length > 0) {
      console.log("     evidence:");
      for (const row of draft.evidence) {
        const source = row.source ? `  ← ${row.source.table}/${row.source.id.slice(0, 8)}` : "";
        console.log(`       ${row.label}: ${row.value}${source}`);
      }
    }
    const counts = draft.reads.reduce<Record<string, number>>((acc, r) => {
      acc[r.table] = (acc[r.table] ?? 0) + 1;
      return acc;
    }, {});
    console.log(`     read ${Object.entries(counts).map(([t, c]) => `${c} ${t}`).join(" · ") || "nothing"}`);
  }

  console.log("\n  ── trace");
  let total = 0;
  for (const { detail } of steps) {
    const ms = Number(detail.ms ?? 0);
    total += ms;
    const flags = Array.isArray(detail.flags) && detail.flags.length ? ` [${(detail.flags as string[]).join(", ")}]` : "";
    console.log(`     ${String(detail.agent ?? "?").padEnd(7)} ${String(detail.step ?? "?").padEnd(10)} ${String(ms).padStart(5)}ms  ${String(detail.summary ?? "")}${flags}`);
  }
  console.log(`     ${"".padEnd(18)} ${String(total).padStart(5)}ms total\n`);
}

async function main(): Promise<void> {
  const messages: ConversationContext["messages"] = [];
  const steps: { step: string; detail: Record<string, unknown> }[] = [];

  console.log(`\nBack of House — chatting as "${persona}" (${handle})`);
  console.log(`  now: ${now.toISOString()}`);
  console.log(`  model: ${isModelConfigured() ? modelId() : "not configured, running the deterministic path"}`);
  console.log(`  type a message, or ctrl-c to quit\n`);

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  for (;;) {
    const text = (await rl.question("you › ")).trim();
    if (!text) continue;
    if (text === "/quit" || text === "/exit") break;

    const id = `msg-${messages.length + 1}`;
    messages.push({ id, direction: "inbound", body: text, createdAt: now.toISOString() });
    steps.length = 0;

    const world = createFixtureWorld({
      now,
      handles: Object.fromEntries(Object.entries(HANDLES).filter(([key]) => key === persona)),
      conversation: { id: "chat", handle, customerId: null, messages: [...messages] },
    });

    const ctx: AgentContext = {
      data: world.port,
      business: world.business,
      now: () => now,
      trace: (step, detail) => steps.push({ step, detail }),
    };

    const startedAt = Date.now();
    const drafts = await handleInbound({ conversationId: "chat", messageId: id }, ctx);
    render(drafts, steps);
    console.log(`  (${Date.now() - startedAt}ms wall clock)\n`);

    const reply = drafts.find((d) => d.kind === "reply");
    if (reply?.kind === "reply") {
      messages.push({
        id: `msg-${messages.length + 1}`,
        direction: "outbound",
        body: reply.payload.text,
        createdAt: now.toISOString(),
      });
    }
  }

  rl.close();
}

await main();
