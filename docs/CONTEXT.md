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
- **Deadline:** Sunday 2026-10-18, 10:00 AM PT. Confirmed by Yousuf (2026-10-17).
- **Product name:** stays **Back of House** (confirmed).

Open human decisions: confirm multi-track entry rules with organizers (one title track plus several sponsored). Who texts as **Maya** in the live demo is still TBD; Maya is a synthetic customer persona, not the shop line.

## Team

| Lane | Role | GitHub user |
| --- | --- | --- |
| 1 | Frontend | aahil1218 |
| 2 | Backend | mojipao |
| 3 | Agents | ybassyiouni (Yousuf Al-Bassyiouni) |

Claims and handoffs live in `docs/STATUS.md`.

## Demo phones and personas

Roles only. Every real number lives in the private `.env`, never in git, because this repo becomes public at submission.

| Role | Env var | Who |
| --- | --- | --- |
| Shop Photon line (inbound) | `PHOTON_AGENT_HANDLE` | The Photon-assigned business iMessage number customers text. Not Maya. |
| Owner (approver) | `OWNER_HANDLE` | Yousuf. Approves in the control room or by iMessage (`Y` / `N` / `?`). |
| Maya | `DEMO_PERSONAS` | Synthetic customer persona. A teammate texts *as Maya* into the shop line; which phone is TBD. |
| Jun, Priya, judges | `DEMO_PERSONAS`, `/join` | Phone simulator or `/join`, as planned. |

Lane 3 holds the filled `.env`; ask in team chat for the numbers.

## Constraints that already apply

- Hackathon: DubHacks 2026. Side-track rules: `docs/TRACKS.md` and the [organizer page](https://dubhacks.notion.site/26-Sponsored-Side-Tracks-5e3ff32c1d7e834d9844812256c9fa06).
- Synthetic data only. Every real phone number, the owner's and the shop line included, lives only in the private `.env`, never in git or docs.
- No secrets in git. API keys never appear in docs, only env var **names**. The names are listed in `planning/ARCHITECTURE.md`.
- Photon: use only the **beta** docs (`https://photon.codes/docs/beta/`) and `@photon-ai/api`. Not `spectrum-ts`.
- Only the demo host runs `PHOTON_INBOUND=on`.
- When an agent's own session notes disagree with repo `planning/*` or this file, **the repo wins**. An agent may still make a small judgment call and append a `docs/DECISIONS.md` row when a note is clearly better (a seed-data bugfix, for example).

## Env vars

The full table is in `planning/ARCHITECTURE.md` under "Environment variables." Values travel privately as one shared `.env` (gitignored).

**Secrets status (2026-10-17):** `PHOTON_PROJECT_ID`, `PHOTON_API_KEY`, `PHOTON_AGENT_HANDLE`, and `OWNER_HANDLE` are set in lane 3's private `.env`. **Square**, **AI Gateway / `AGENT_MODEL`**, `PHOTON_TEST_SENDER`, and `DEMO_PERSONAS` are not filled yet. Do not invent values.

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
- `supabase/migrations/0001_init.sql` is **applied** (Supabase migration name `init`). All tables are empty until the seed runs.
- Verified: the browser key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`, the `sb_publishable_...` key) can read every app table, sees nothing in `photon_cursor`, and cannot write anything.
- Typed rows: `import type { Database, Tables } from "@boh/shared"` (generated into `packages/shared/src/db.ts`; regenerate after each migration). Server client: `db()` in `apps/server/src/db.ts`.
- Lane 2 applies migrations through the `supabase-boh` MCP entry (pinned to this project). Others: never apply schema changes; ask lane 2.

## Interfaces other agents must not break

- `packages/shared` (`@boh/shared`): the contract. Additive changes only, each with a `docs/DECISIONS.md` row.
- `supabase/migrations/0001_init.sql`: never edited after it is applied; add new migrations.
- Server HTTP API in `planning/ARCHITECTURE.md`.

## Photon project (lane 3)

- **Project ID:** `pho_prj_01m55nwa3zesk81kyc2gb9krkj`. Shareable team config, also in the private `.env` as `PHOTON_PROJECT_ID`; point every script at this project.
- **API key:** private `.env` only, as `PHOTON_API_KEY`. Never commit it or paste it into docs.
- Shop line and owner handle: see "Demo phones and personas" above.
- Photon 2.0 beta only: dashboard `app.beta.photon.codes`, API `https://api.photon.codes/v1`, package `@photon-ai/api`. The `photon.co/beta` URL in `planning/LANE-3-AGENTS.md` step 1 is wrong.

## Photon facts verified

None yet. Lane 3 records the ping round trip result here after `scripts/photon-ping.ts`.

## Photon events

None yet. Lane 2 records the received-message event type and field paths here.
