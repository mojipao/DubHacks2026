# Project context

Agents: read this file after `AGENTS.md` and before writing code. If you change a fact below, update it here and add a row to `docs/DECISIONS.md` in the same commit.

## Status

- **Product:** Back of House. An operations agent for small food businesses. Customers text the shop on iMessage through Photon; agents read the shop's customers, orders, capacity, and stock to propose replies, Square payment links, and supplier reorders, including counteroffers when a request can't be met as asked; nothing goes out until the owner approves it in the live control room or by replying to an iMessage.
- **`v-core` scope (Sat 11 PM):** real-phone order and payment loop, the 4-dozen-croissant counteroffer with a linked butter reorder, the agent trace, deterministic Guard flags, and the friction saved counter. See `planning/README.md`.
- **Demo business:** Larch & Rye, a fictional Seattle bakery. All data synthetic.
- **Title track:** Cook Smarter
- **Sponsored tracks:** Photon, VEYZL, SideShift
- **Stack:** TypeScript on Node 24, pnpm workspaces. Next.js control room, Hono server, Supabase Postgres + Realtime, Photon 2.0 beta API, Square sandbox, Vercel AI SDK. Details: `planning/ARCHITECTURE.md`.
- **Plan:** `planning/README.md`, then your lane file in `planning/`.
- **Assumed deadline:** Sunday 2026-10-18, 10:00 AM PT. Unconfirmed; a human must verify with organizers.

Open human decisions: confirm the deadline, confirm multi-track entry rules, and decide whether to keep the name "Back of House."

## Team

| Lane | Role | GitHub user |
| --- | --- | --- |
| 1 | Frontend | aahil1218 |
| 2 | Backend | mojipao |
| 3 | Agents | unassigned |

Claims and handoffs live in `docs/STATUS.md`.

## Constraints that already apply

- Hackathon: DubHacks 2026. Side-track rules: `docs/TRACKS.md` and the [organizer page](https://dubhacks.notion.site/26-Sponsored-Side-Tracks-5e3ff32c1d7e834d9844812256c9fa06).
- Synthetic data only. Real phone numbers live only in the private `.env` (`DEMO_PERSONAS`), never in git.
- No secrets in git. Env var names are listed in `planning/ARCHITECTURE.md`.
- Photon: use only the **beta** docs (`https://photon.codes/docs/beta/`) and `@photon-ai/api`. Not `spectrum-ts`.
- Only the demo host runs `PHOTON_INBOUND=on`.

## Env vars

The full table is in `planning/ARCHITECTURE.md` under "Environment variables." Values travel privately as one shared `.env`.

## Workspace (live on `main`)

- pnpm workspace with `apps/*` and `packages/*`. Install pnpm 10 (`npm i -g pnpm@10`; old corepack versions fail pnpm's signature check), then `pnpm install` at the root.
- `@boh/shared` is live. Depend on it with `"@boh/shared": "workspace:*"`. Next.js needs `transpilePackages: ["@boh/shared"]`.
- `@boh/server`: `pnpm --filter @boh/server dev`, then `curl localhost:8787/health`. Runs with no keys; missing integrations show as `unconfigured`.
- `@boh/web` (lane 1): Next.js control room under `apps/web`. Vercel is connected to this GitHub repo; set Root Directory to `apps/web` and the web env vars from the architecture table.
- New packages add a `typecheck` script (and `build`/`lint`/`test` if they have them) so CI covers them.
- CI runs on Node 24. Local Node 22 works for the server today; Photon's examples ask for 24, so the demo host should use 24.

## Supabase

- Project ref `jxluhvblusfzrlktqaee`, URL `https://jxluhvblusfzrlktqaee.supabase.co` (owned by mojipao). Use this for `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL`. Keys come in the shared `.env`.
- **Do not use project `ykvvrkvihmfvcesbnker`**; it belongs to an unrelated project.
- The Supabase GitHub integration is not used. Lane 2 applies migrations through the Supabase MCP.
- `supabase/migrations/0001_init.sql` is written but not applied yet. Lane 2 will note here when it is.

## Interfaces other agents must not break

- `packages/shared` (`@boh/shared`): the contract. Additive changes only, each with a `docs/DECISIONS.md` row.
- `supabase/migrations/0001_init.sql`: never edited after it is applied; add new migrations.
- Server HTTP API in `planning/ARCHITECTURE.md`.

## Photon facts verified

None yet. Lane 3 records the ping round trip result here.

## Photon events

None yet. Lane 2 records the received-message event type and field paths here.
