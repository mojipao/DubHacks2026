/**
 * Phase 0: prove the Photon 2.0 beta iMessage round trip.
 *
 * Verified 2026-10-18: inbound and outbound both work on a shared line, but a send
 * carrying `parentMessageId` is rejected with 409 SPACE_NOT_SENDABLE. See the note at
 * the reply below before adding it back.
 *
 *   pnpm tsx scripts/photon-ping.ts
 *   pnpm tsx scripts/photon-ping.ts --followup
 *
 * Then text `ping` as an iMessage (blue bubble) to PHOTON_AGENT_HANDLE from
 * PHOTON_TEST_SENDER. The script polls for it, replies once in the same space,
 * and prints a redacted dump of the received message for `docs/CONTEXT.md`.
 *
 * `--assign=+1...` assigns a sender to a shared line first. A shared line only receives
 * from assigned handles, so an unassigned phone's texts are dropped with no error
 * anywhere; the preflight checks for this before you start texting. Assignments are
 * releasable, so a consumed slot is recoverable (the free plan allows 25).
 *
 * `--followup` additionally sends two unprompted messages into the same space,
 * at +2 and +15 minutes, with no new inbound message. Owner notifications and
 * the win-back scan both depend on whether those arrive, so the result goes in
 * `docs/CONTEXT.md` either way.
 *
 * Talks to the REST API directly (Node's fetch) instead of `@photon-ai/api`, so
 * lane 3 does not have to add a dependency to lane 2's root `package.json`.
 * Request and response shapes come from https://api.photon.codes/openapi.json.
 */
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });

const API = "https://api.photon.codes/v1";
const POLL_INTERVAL_MS = 2_000;
/** Also accept a text sent shortly BEFORE the script started, so order of operations stops mattering. */
const LOOKBACK_MS = 120_000;
const REQUEST_TIMEOUT_MS = 15_000;
const FOLLOWUP_DELAYS_MS = [2 * 60_000, 15 * 60_000];

const PROJECT_ID = required("PHOTON_PROJECT_ID");
const API_KEY = required("PHOTON_API_KEY");
const TEST_SENDER = required("PHOTON_TEST_SENDER");
const AGENT_HANDLE = process.env.PHOTON_AGENT_HANDLE;

const args = new Set(process.argv.slice(2));
const WITH_FOLLOWUP = args.has("--followup");
/** `--assign` with no value assigns PHOTON_TEST_SENDER. */
const ASSIGN = args.has("--assign") ? TEST_SENDER : argValue("--assign");
const PING_TEXT = (argValue("--text") ?? "ping").toLowerCase();
const WAIT_MS = Number(argValue("--wait") ?? 240) * 1_000;
/** Take any text from the sender, not just one containing the keyword. */
const ACCEPT_ANY = args.has("--any");

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    fail(`${name} is missing from the root .env. See .env.example.`);
  }
  return value;
}

function argValue(flag: string): string | undefined {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`${flag}=`));
  return hit?.slice(flag.length + 1);
}

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

/** Phone numbers and emails must never reach git, a screenshot, or a docs paste. */
function redact<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value).replace(/\+[1-9]\d{6,14}/g, "+1XXXXXXXXXX").replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "redacted@example.com"),
  ) as T;
}

interface ApiResult<T> {
  status: number;
  requestId: string | null;
  replayed: boolean;
  body: T;
}

async function api<T>(
  method: "GET" | "POST",
  path: string,
  init: {
    query?: Record<string, string | undefined>;
    body?: unknown;
    idempotencyKey?: string;
    /** Statuses to return instead of failing, for calls where a 4xx is a valid state. */
    allowStatuses?: number[];
  } = {},
): Promise<ApiResult<T>> {
  const url = new URL(API + path);
  for (const [key, value] of Object.entries(init.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, value);
  }

  const headers: Record<string, string> = { authorization: `Bearer ${API_KEY}`, accept: "application/json" };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  // The API requires an idempotency key on every send; keep it stable across retries of the same logical message.
  if (init.idempotencyKey) headers["idempotency-key"] = init.idempotencyKey;

  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, {
      method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const text = await response.text();
    const body = text ? safeJson(text) : null;

    if (response.status === 429 && attempt <= 3) {
      const wait = Number(response.headers.get("retry-after") ?? 2) * 1_000;
      console.warn(`  429 rate limited, honoring Retry-After: waiting ${wait / 1000}s`);
      await sleep(wait);
      continue;
    }

    if (!response.ok && !(init.allowStatuses ?? []).includes(response.status)) {
      const detail = typeof body === "object" && body ? JSON.stringify(redact(body)) : text.slice(0, 400);
      fail(
        `${method} ${path} → ${response.status}\n  ${detail}\n` +
          (response.status === 401 || response.status === 403
            ? "  Check PHOTON_API_KEY and that it has project:read, project:write, platforms:read, platforms:write."
            : ""),
      );
    }

    return {
      status: response.status,
      requestId: response.headers.get("x-request-id") ?? response.headers.get("request-id"),
      replayed: response.headers.get("idempotent-replayed") === "true",
      body: body as T,
    };
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 400) };
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface UserSnapshot {
  id: string;
  handle: string;
  kind: string;
  platform: string;
  details?: { type?: string; resourceId?: string };
}

interface ReceivedMessage {
  id: string;
  status: string;
  platform: string;
  content: { type: string; format?: string; text?: string };
  space: { id: string; kind: string; participantIds: string[] };
  sentBy: UserSnapshot;
  /** Present on a received message; the agent identity for THIS conversation. */
  receivedBy?: UserSnapshot;
  /** Fallback the spec also allows. Phase 0 records which one Photon actually sends. */
  addressedTo?: UserSnapshot;
  timestamps: { receivedAt: string };
  createdAt: string;
}

interface Assignment {
  assignmentId: string;
  handle: string;
  assignedPhoneNumber: string;
  releasedAt?: string;
  createdAt: string;
}

/** Assigns a sender to a shared line and returns the agent number it was given. */
async function assignSender(handle: string): Promise<string | null> {
  console.log(`  assigning ${handle} to a shared line…`);
  const result = await api<Assignment>("POST", `/projects/${PROJECT_ID}/platforms/imessage/assignments`, {
    // Keyed to the handle so re-running never burns a second slot from the 25.
    idempotencyKey: `assign:${handle}`,
    body: { handle },
    // Already assigned is the state we wanted; the listing below reports the number.
    allowStatuses: [409],
  });
  if (result.status === 409) {
    console.log(`  ${handle} already has a live assignment, leaving it alone\n`);
    return null;
  }
  console.log(`✓ ${handle} now texts ${result.body.assignedPhoneNumber} (assignment ${result.body.assignmentId})`);
  console.log(`  set PHOTON_AGENT_HANDLE=${result.body.assignedPhoneNumber} in .env\n`);
  return result.body.assignedPhoneNumber;
}

/** Fail loudly before the human starts texting, rather than after a silent two-minute wait. */
async function preflight(): Promise<void> {
  const project = await api<{ id: string; name?: string; slug?: string }>("GET", `/projects/${PROJECT_ID}`);
  console.log(`✓ project ${project.body.name ?? project.body.id} (auth ok)`);

  if (ASSIGN) await assignSender(ASSIGN);

  // Note the key: messages come back under `items`, assignments under `assignments`.
  // Defaulting a missing key to [] would report "0 assignments" for a shape mismatch,
  // which reads as "go assign your phone" when the real problem is this script.
  const assignments = await api<{ assignments: Assignment[] }>(
    "GET",
    `/projects/${PROJECT_ID}/platforms/imessage/assignments`,
  );
  if (!Array.isArray(assignments.body.assignments)) {
    fail(
      "The assignments response has no `assignments` array, so this script is reading the wrong shape.\n" +
        `  Got: ${JSON.stringify(redact(assignments.body)).slice(0, 200)}`,
    );
  }
  const live = assignments.body.assignments.filter((a) => !a.releasedAt);

  console.log(`\n  shared iMessage assignments (${live.length} live, free plan allows 25):`);
  for (const a of live) {
    const mine = a.handle === TEST_SENDER ? "  ← PHOTON_TEST_SENDER" : "";
    console.log(`    ${a.handle} texts ${a.assignedPhoneNumber}${mine}`);
  }

  const mine = live.find((a) => a.handle === TEST_SENDER);
  if (!mine) {
    fail(
      `${TEST_SENDER} is not assigned to a shared line, so Photon will drop its texts with no error.\n` +
        `  Fix it by re-running with --assign, or in the dashboard at app.beta.photon.codes → iMessage.`,
    );
  }
  if (AGENT_HANDLE && mine.assignedPhoneNumber !== AGENT_HANDLE) {
    console.warn(
      `\n  ! PHOTON_AGENT_HANDLE is ${AGENT_HANDLE} but ${TEST_SENDER} is assigned ${mine.assignedPhoneNumber}.` +
        `\n    Agent numbers differ per sender. Text ${mine.assignedPhoneNumber} from this phone.`,
    );
  }

  console.log(`\n→ Now text "${PING_TEXT}" as an iMessage (blue bubble) to ${mine.assignedPhoneNumber}`);
  console.log(`  from ${TEST_SENDER}. Waiting up to ${WAIT_MS / 1000}s…\n`);
}

function isPing(m: ReceivedMessage): boolean {
  return (
    m.status === "received" &&
    m.platform === "imessage" &&
    m.content.type === "text" &&
    m.content.format === "plain" &&
    m.sentBy.handle === TEST_SENDER &&
    m.space.kind === "direct" &&
    // Substring, not equality: "Ping!", trailing spaces and autocorrect all still count,
    // and a failed match costs another four minutes of someone's evening.
    (ACCEPT_ANY || (m.content.text ?? "").toLowerCase().includes(PING_TEXT))
  );
}

async function pollForPing(createdSince: string): Promise<ReceivedMessage> {
  const deadline = Date.now() + WAIT_MS;
  let polls = 0;

  while (Date.now() < deadline) {
    polls++;
    const page = await api<{ items: ReceivedMessage[] }>("GET", `/projects/${PROJECT_ID}/messages`, {
      query: {
        createdSince,
        direction: "received",
        platform: "imessage",
        order: "asc",
        pageSize: "100",
      },
    });

    const match = (page.body.items ?? []).find(isPing);
    if (match) {
      console.log(`✓ received after ${polls} poll${polls === 1 ? "" : "s"}`);
      return match;
    }

    const left = Math.ceil((deadline - Date.now()) / 1000);
    process.stdout.write(`  waiting… ${left}s left (poll ${polls})            \r`);
    await sleep(POLL_INTERVAL_MS);
  }

  fail(
    `No message containing "${PING_TEXT}" from ${TEST_SENDER} in the last ${(WAIT_MS + LOOKBACK_MS) / 1000}s.\n` +
      "  Most likely: the text was not actually sent inside the window — send it while this is running.\n" +
      "  Otherwise check: blue iMessage bubble (not green SMS), the right agent number, and the\n" +
      "  dashboard's API Activities page to see whether the message reached Photon at all.\n" +
      "  Re-run with --any to accept any text from your phone, in case the wording is the problem.",
  );
}

async function sendText(
  spaceId: string,
  senderId: string,
  text: string,
  idempotencyKey: string,
  parentMessageId?: string,
): Promise<ApiResult<{ id: string; status: string }>> {
  return api("POST", `/projects/${PROJECT_ID}/messages`, {
    idempotencyKey,
    body: {
      spaceId,
      senderId,
      ...(parentMessageId ? { parentMessageId } : {}),
      content: { type: "text", format: "plain", text },
    },
  });
}

async function main(): Promise<void> {
  console.log("Photon 2.0 beta ping test\n");
  const startedAt = new Date(Date.now() - LOOKBACK_MS).toISOString();
  await preflight();

  const detectedAt = Date.now();
  const ping = await pollForPing(startedAt);

  const receivedAt = new Date(ping.timestamps.receivedAt).getTime();
  console.log(`  photon received it at ${ping.timestamps.receivedAt} (${Date.now() - receivedAt}ms ago)`);
  if (detectedAt < receivedAt) console.log(`  detected ${receivedAt - detectedAt}ms into the poll loop`);

  console.log("\n--- received message, redacted: safe to paste into docs/CONTEXT.md ---");
  console.dir(redact(ping), { depth: 5 });
  console.log("--- end ---\n");

  // The spec marks `receivedBy` optional, so record which field actually carries the agent identity.
  const agent = ping.receivedBy ?? ping.addressedTo;
  if (!agent) {
    fail("The received message has neither receivedBy nor addressedTo, so there is no agent id to reply from.");
  }
  console.log(`  agent identity came from ${ping.receivedBy ? "receivedBy" : "addressedTo"} (kind "${agent.kind}", line type "${agent.details?.type ?? "?"}")`);
  console.log(`  replying in space ${ping.space.id} as ${agent.id}`);

  const sentAt = Date.now();
  // Deliberately no parentMessageId. A shared iMessage line rejects threaded replies
  // with 409 SPACE_NOT_SENDABLE ("Replies are not supported for this Space"), which
  // reads like the space is unsendable when a plain send to the same space works. The
  // field is valid in the API and valid on other platforms, just not here.
  const reply = await sendText(ping.space.id, agent.id, "pong — Back of House is listening.", `ping-reply:${ping.id}`);
  console.log(
    `✓ reply accepted: ${reply.status} in ${Date.now() - sentAt}ms` +
      ` · message ${reply.body.id}${reply.replayed ? " (idempotent replay)" : ""}` +
      `${reply.requestId ? ` · request ${reply.requestId}` : ""}`,
  );
  console.log("  202 means accepted, not delivered. Confirm it arrived on the phone.\n");

  if (!WITH_FOLLOWUP) {
    console.log("Run again with --followup to test unprompted sends (owner notifications and win-back need them).");
    return;
  }

  console.log("Follow-up test: unprompted sends into the same space, with no new inbound message.");
  for (const [index, delay] of FOLLOWUP_DELAYS_MS.entries()) {
    const minutes = delay / 60_000;
    console.log(`\n  waiting ${minutes} minutes…`);
    await sleep(delay);

    const at = Date.now();
    const followup = await sendText(
      ping.space.id,
      agent.id,
      `Unprompted follow-up test ${index + 1} of ${FOLLOWUP_DELAYS_MS.length}, sent ${minutes} minutes after your ping.`,
      `ping-followup:${ping.id}:${minutes}m`,
    );
    console.log(
      `  +${minutes}m → accepted ${followup.status} in ${Date.now() - at}ms · message ${followup.body.id}` +
        `${followup.requestId ? ` · request ${followup.requestId}` : ""}`,
    );
    console.log(`  Check the phone: did follow-up ${index + 1} actually arrive? Accepted is not delivered.`);
  }

  console.log("\nRecord both answers under \"Photon facts verified\" in docs/CONTEXT.md.");
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
});
