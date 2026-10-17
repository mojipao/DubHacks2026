/**
 * Tells you what your `.env` is missing, and whether your shared secrets match
 * your teammates' — without printing a single value.
 *
 *   pnpm tsx scripts/env-doctor.ts
 *   pnpm tsx scripts/env-doctor.ts --strict    # non-zero exit when something required is missing
 *
 * Three people on three clones means three `.env` files that drift, and the usual
 * symptom is an afternoon lost to "works on my machine". The fix is not a better way
 * to send the file around; it is being able to tell, in one line of team chat, whether
 * two machines hold the same key.
 *
 * So each shared secret gets a short **fingerprint**: an HMAC of its value under a
 * constant project salt, truncated. Same key, same fingerprint. Different key,
 * different fingerprint. Four hex characters is 16 bits, which is enough to spot a
 * mismatch and far too little to reconstruct anything, and the HMAC means it is not a
 * plain hash anyone could look up.
 *
 * Paste the SYNC line in the team chat. Never paste the `.env` itself.
 *
 * `--share` is the one exception, and it exists because the team distributes secrets by
 * hand (see `planning/README.md`): it prints the shared block **only**, so re-pasting it
 * can never carry someone else's `PHOTON_INBOUND=on` onto your machine and have two
 * listeners answering every customer twice. It writes nothing to disk.
 */
import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Constant and public on purpose: it only has to stop the digests being plain hashes. */
const FINGERPRINT_SALT = "back-of-house/env-doctor/v1";

type Kind = "shared-secret" | "shared-config" | "per-machine";

interface Spec {
  name: string;
  kind: Kind;
  /** Whose job it is to produce the value, when it is missing. */
  owner: string;
  /** Required for the `v-core` demo loop to work at all. */
  required: boolean;
  note?: string;
}

/**
 * The canonical list. `.env.example` is the shape of the file; this is the shape plus
 * who owns each value and whether it may differ between machines, which is the part
 * that actually causes the drift.
 */
const SPECS: readonly Spec[] = [
  // Shared secrets: identical on all three machines, never in git.
  { name: "OWNER_TOKEN", kind: "shared-secret", owner: "lane 2", required: true, note: "server and web must agree" },
  { name: "SUPABASE_SERVICE_ROLE_KEY", kind: "shared-secret", owner: "lane 2 (mojipao)", required: true },
  { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", kind: "shared-secret", owner: "lane 2 (mojipao)", required: true },
  { name: "PHOTON_API_KEY", kind: "shared-secret", owner: "lane 3 (ybassyiouni)", required: true },
  { name: "SQUARE_ACCESS_TOKEN", kind: "shared-secret", owner: "lane 2", required: true },
  { name: "SQUARE_WEBHOOK_SIGNATURE_KEY", kind: "shared-secret", owner: "lane 2", required: false, note: "demo host only" },
  { name: "AI_GATEWAY_API_KEY", kind: "shared-secret", owner: "lane 3 (ybassyiouni)", required: false, note: "agents fall back to the deterministic path without it" },

  // Shared config: identical everywhere, but not secret. Safe in docs/CONTEXT.md.
  { name: "SUPABASE_URL", kind: "shared-config", owner: "lane 2", required: true },
  { name: "NEXT_PUBLIC_SUPABASE_URL", kind: "shared-config", owner: "lane 2", required: true },
  { name: "PHOTON_PROJECT_ID", kind: "shared-config", owner: "lane 3", required: true },
  { name: "PHOTON_AGENT_HANDLE", kind: "shared-config", owner: "lane 3", required: true, note: "the shop line customers text" },
  { name: "OWNER_HANDLE", kind: "shared-config", owner: "lane 3", required: true, note: "only this handle can approve by text" },
  { name: "SQUARE_LOCATION_ID", kind: "shared-config", owner: "lane 2", required: true },
  { name: "SQUARE_ENVIRONMENT", kind: "shared-config", owner: "lane 2", required: true },
  { name: "AGENT_MODEL", kind: "shared-config", owner: "lane 3", required: false, note: "anthropic/claude-haiku-4-5" },
  { name: "DEMO_PERSONAS", kind: "shared-config", owner: "lane 1", required: false, note: "persona=E.164 pairs" },

  // Per-machine: these are SUPPOSED to differ. Copying someone else's is the bug.
  { name: "PORT", kind: "per-machine", owner: "you", required: false },
  { name: "SERVER_URL", kind: "per-machine", owner: "you", required: false },
  { name: "NEXT_PUBLIC_DATA_MODE", kind: "per-machine", owner: "you", required: false, note: "live | mock" },
  { name: "AGENT_MODE", kind: "per-machine", owner: "you", required: false, note: "live | stub" },
  { name: "PHOTON_INBOUND", kind: "per-machine", owner: "you", required: false, note: "on only on the demo host; two listeners answer every customer twice" },
  { name: "OWNER_NOTIFY", kind: "per-machine", owner: "you", required: false, note: "on only on the demo host" },
  { name: "PHOTON_TEST_SENDER", kind: "per-machine", owner: "you", required: false, note: "your own phone, E.164" },
  { name: "SQUARE_WEBHOOK_URL", kind: "per-machine", owner: "you", required: false, note: "your ngrok domain" },
];

const PLACEHOLDERS = [/^your[-_]/i, /^<.*>$/, /^changeme$/i, /^xxx+$/i, /^todo$/i, /^replace/i, /^\.\.\.$/];

function parseEnvFile(path: string): Map<string, string> {
  const values = new Map<string, string>();
  if (!existsSync(path)) return values;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values.set(key, value);
  }
  return values;
}

/** Four hex characters of an HMAC: enough to compare, useless to attack. */
const fingerprint = (value: string): string =>
  createHmac("sha256", FINGERPRINT_SALT).update(value).digest("hex").slice(0, 4);

const root = (name: string): string => fileURLToPath(new URL(`../${name}`, import.meta.url));

const env = parseEnvFile(root(".env"));
const example = parseEnvFile(root(".env.example"));
const strict = process.argv.includes("--strict");

if (!existsSync(root(".env"))) {
  console.error("\n✗ No .env at the repo root. Copy .env.example to .env and fill it in.\n");
  process.exit(1);
}

/**
 * Prints the shared block for hand-distribution: every shared value that is set, and
 * nothing that is per-machine. Secrets go to stdout here by design, so it is opt-in.
 */
if (process.argv.includes("--share")) {
  const shared = SPECS.filter((spec) => spec.kind !== "per-machine");
  const set = shared.filter((spec) => {
    const value = env.get(spec.name);
    return value !== undefined && value !== "";
  });
  const empty = shared.filter((spec) => !set.includes(spec));
  const perMachine = SPECS.filter((spec) => spec.kind === "per-machine").map((spec) => spec.name);

  console.log(`\n# Back of House shared env — ${new Date().toISOString().slice(0, 16).replace("T", " ")}`);
  console.log(`# CONTAINS SECRETS. Send through the team DM or a password manager, never git, never a screenshot.`);
  console.log(`# Paste these lines into your own .env, replacing any you already have.`);
  console.log(`#`);
  console.log(`# Deliberately NOT included, because these differ per machine — keep your own:`);
  console.log(`#   ${perMachine.join(", ")}`);
  if (empty.length > 0) {
    console.log(`#`);
    console.log(`# Still nobody's: ${empty.map((spec) => `${spec.name} (${spec.owner})`).join(", ")}`);
  }
  console.log("");
  for (const spec of set) console.log(`${spec.name}=${env.get(spec.name)}`);
  console.log("");
  process.exit(0);
}

const problems: string[] = [];
const byKind: Record<Kind, Spec[]> = { "shared-secret": [], "shared-config": [], "per-machine": [] };
for (const spec of SPECS) byKind[spec.kind].push(spec);

const LABELS: Record<Kind, string> = {
  "shared-secret": "Shared secrets — identical on every machine, never in git",
  "shared-config": "Shared config — identical everywhere, not secret",
  "per-machine": "Per-machine — these are meant to differ",
};

console.log(`\n  env doctor · ${new Date().toISOString().slice(0, 16).replace("T", " ")}\n`);

const syncParts: string[] = [];

for (const kind of ["shared-secret", "shared-config", "per-machine"] as const) {
  console.log(`  ${LABELS[kind]}`);
  for (const spec of byKind[kind]) {
    const raw = env.get(spec.name);
    const set = raw !== undefined && raw !== "";
    const placeholder = set && PLACEHOLDERS.some((p) => p.test(raw));

    let status: string;
    if (!set) {
      status = spec.required ? "MISSING" : "empty";
      if (spec.required) problems.push(`${spec.name} is required and empty — ask ${spec.owner}`);
    } else if (placeholder) {
      status = "PLACEHOLDER";
      problems.push(`${spec.name} still holds a placeholder — ask ${spec.owner}`);
    } else {
      status = "set";
    }

    // Only shared values get a fingerprint; per-machine ones are supposed to differ.
    const digest =
      raw !== undefined && set && !placeholder && kind !== "per-machine" ? fingerprint(raw) : null;
    const fp = digest ? ` fp:${digest}` : "";
    // One entry per distinct value: a NEXT_PUBLIC_ twin of the same value adds nothing.
    if (digest) {
      const label = `${spec.name.replace(/^NEXT_PUBLIC_/, "")}:${digest}`;
      if (!syncParts.includes(label)) syncParts.push(label);
    }

    const mark = status === "set" ? "✓" : status === "empty" ? "·" : "✗";
    const note = spec.note ? `  — ${spec.note}` : "";
    console.log(`    ${mark} ${spec.name.padEnd(30)} ${status.padEnd(12)}${fp.padEnd(9)}${note}`);
  }
  console.log("");
}

// Pairs the architecture doc says must hold the same value. A mismatch here is the
// kind of thing that looks like a Supabase outage for twenty minutes.
const MUST_MATCH: readonly [string, string][] = [["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]];
for (const [a, b] of MUST_MATCH) {
  const left = env.get(a);
  const right = env.get(b);
  if (left && right && left !== right) {
    problems.push(`${a} and ${b} must hold the same value, and do not (fp:${fingerprint(left)} vs fp:${fingerprint(right)})`);
  }
}

// Drift between the example file and what the code actually reads.
const exampleNames = new Set(example.keys());
const specNames = new Set(SPECS.map((s) => s.name));
const missingFromExample = [...specNames].filter((n) => !exampleNames.has(n));
const missingFromSpecs = [...exampleNames].filter((n) => !specNames.has(n));
const extraInEnv = [...env.keys()].filter((n) => !specNames.has(n) && !exampleNames.has(n));

if (missingFromExample.length) {
  console.log(`  ! .env.example does not list: ${missingFromExample.join(", ")}`);
  console.log(`    That file is lane 2's; ask them to add the name (names only, never values).\n`);
}
if (missingFromSpecs.length) {
  console.log(`  ! .env.example lists names this script does not classify: ${missingFromSpecs.join(", ")}`);
  console.log(`    Add them to SPECS in scripts/env-doctor.ts so they get checked.\n`);
}
if (extraInEnv.length) {
  console.log(`  ! your .env has names nobody expects: ${extraInEnv.join(", ")}\n`);
}

console.log("  SYNC LINE — paste this in the team chat to compare, never the .env itself:");
console.log(`    ${syncParts.join(" ") || "(nothing shared is set yet)"}\n`);

if (problems.length) {
  console.log(`  ${problems.length} thing${problems.length === 1 ? "" : "s"} to chase:`);
  for (const problem of problems) console.log(`    - ${problem}`);
  console.log("");
}

const requiredMissing = problems.length > 0;
if (strict && requiredMissing) process.exit(1);
console.log(requiredMissing ? "  Incomplete, but nothing here blocks the agents package.\n" : "  All good.\n");
