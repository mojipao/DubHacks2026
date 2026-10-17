/**
 * Runs everything the demo host needs and says, in one screen, whether it's live.
 *
 *   pnpm demo:host
 *
 * Starts the server with the iMessage listener and owner notifications on, starts ngrok on the
 * domain in SQUARE_WEBHOOK_URL so Square's webhook reaches this laptop, keeps the Mac awake, then
 * checks /health locally and through the tunnel. Agents always run live here. Ctrl-C stops all of it.
 * Only one machine may run this: two listeners answer every customer twice.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { env, features } from "../apps/server/src/env.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const children: ChildProcess[] = [];

function start(name: string, cmd: string, args: string[], extraEnv: Record<string, string> = {}) {
  const child = spawn(cmd, args, { cwd: ROOT, env: { ...process.env, ...extraEnv }, stdio: ["ignore", "pipe", "pipe"] });
  const prefix = (line: string) => `[${name}] ${line}`;
  child.stdout?.on("data", (d: Buffer) => process.stdout.write(d.toString().split("\n").filter(Boolean).map(prefix).join("\n") + "\n"));
  child.stderr?.on("data", (d: Buffer) => process.stderr.write(d.toString().split("\n").filter(Boolean).map(prefix).join("\n") + "\n"));
  child.on("exit", (code) => console.log(prefix(`exited (${code})`)));
  children.push(child);
  return child;
}

function stopAll() {
  for (const c of children) c.kill("SIGTERM");
  process.exit(0);
}
process.on("SIGINT", stopAll);
process.on("SIGTERM", stopAll);

async function health(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000), headers: { "ngrok-skip-browser-warning": "1" } });
    return res.ok ? ((await res.json()) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function waitFor<T>(fn: () => Promise<T | null>, seconds: number): Promise<T | null> {
  for (let i = 0; i < seconds; i++) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return null;
}

const tunnelHost = env.SQUARE_WEBHOOK_URL ? new URL(env.SQUARE_WEBHOOK_URL).host : null;

start("server", "pnpm", ["--filter", "@boh/server", "start"], { PHOTON_INBOUND: "on", OWNER_NOTIFY: "on", AGENT_MODE: "live" });
if (tunnelHost) start("ngrok", "ngrok", ["http", `--url=${tunnelHost}`, String(env.PORT), "--log=stderr", "--log-level=warn"]);
if (process.platform === "darwin") start("awake", "caffeinate", ["-dimsu"]);

await waitFor(() => health(`http://localhost:${env.PORT}/health`), 30);
// The Photon socket connects a moment after the server answers; give it time before judging.
const local =
  (await waitFor(async () => {
    const h = await health(`http://localhost:${env.PORT}/health`);
    return (h?.photonSocket as { connected?: boolean } | undefined)?.connected ? h : null;
  }, 15)) ?? (await health(`http://localhost:${env.PORT}/health`));
const viaTunnel = tunnelHost ? await waitFor(() => health(`https://${tunnelHost}/health`), 20) : null;
const socket = (local?.photonSocket ?? {}) as { connected?: boolean; lastError?: string | null };

const checks: [string, boolean, string][] = [
  ["Server", Boolean(local), `http://localhost:${env.PORT}`],
  ["Database", local?.database === true, "Supabase"],
  ["iMessage listener", socket.connected === true, socket.lastError ?? (features.photon ? "Photon socket" : "PHOTON_* keys missing")],
  ["Agents", local?.agentMode === "live", `AGENT_MODE=${String(local?.agentMode)}`],
  ["Owner by text", local?.ownerHandleConfigured === true, "OWNER_HANDLE; the owner must have texted the line once"],
  ["Square", local?.squareMode === "sandbox" || local?.squareMode === "production", String(local?.squareMode)],
  ["Square webhook", local?.squareWebhook === true && Boolean(viaTunnel), tunnelHost ? `https://${tunnelHost}/webhooks/square` : "SQUARE_WEBHOOK_URL missing"],
];
console.log("\nDemo host");
for (const [name, ok, detail] of checks) console.log(`  ${ok ? "✓" : "✗"} ${name.padEnd(18)} ${detail}`);
console.log(
  checks.every(([, ok]) => ok)
    ? "\nAll live. Leave this running; Ctrl-C stops the server, ngrok, and caffeinate.\n"
    : "\nSomething above is off. The demo still runs on /dev/inbound and /dev/mark-paid; fix or fall back.\n",
);
