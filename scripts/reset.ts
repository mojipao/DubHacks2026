/**
 * Wipes demo state and reseeds. The team shares one Supabase project, so announce it in docs/STATUS.md first.
 *
 *   pnpm reset --yes
 */
import { fileURLToPath } from "node:url";
import { db } from "../apps/server/src/db.ts";
import { logEvent } from "../apps/server/src/events.ts";
import { setPhotonCursor } from "../apps/server/src/photon/inbound.ts";
import { seed, seedCustomerIds } from "./seed.ts";

const ALL = "00000000-0000-0000-0000-000000000000";

async function wipe(table: "orders" | "proposals" | "messages" | "conversations" | "customers", build: (q: any) => any) {
  const { error } = await build(db().from(table).delete());
  if (error) throw new Error(`wipe ${table}: ${error.message}`);
}

export async function reset() {
  const started = Date.now();
  // Order matters for foreign keys: agent orders point at proposals, proposals at messages and conversations.
  await wipe("orders", (q) => q.eq("source", "agent"));
  await wipe("proposals", (q) => q.neq("id", ALL));
  await wipe("messages", (q) => q.neq("id", ALL));
  await wipe("conversations", (q) => q.neq("id", ALL));
  const { error: eventsError } = await db().from("events").delete().gte("id", 0);
  if (eventsError) throw new Error(`wipe events: ${eventsError.message}`);

  // Judges who joined and leftover test customers go; seed customers and their histories stay.
  const keep = seedCustomerIds();
  await wipe("customers", (q) => (keep.length ? q.not("id", "in", `(${keep.join(",")})`) : q.neq("id", ALL)));

  // Subscribing at 0 starts live, so messages from before the reset never replay.
  await setPhotonCursor(0);

  const summary = await seed();
  await logEvent("system", "demo.reset", null, { ms: Date.now() - started });
  return { ...summary, ms: Date.now() - started };
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  if (!process.argv.includes("--yes")) {
    console.error("This wipes proposals, messages, conversations, events, and agent orders in the shared database.\nRerun with --yes.");
    process.exit(1);
  }
  reset()
    .then((s) => console.log("Reset complete:", s))
    .catch((err: Error) => {
      console.error(err.message);
      process.exit(1);
    });
}
