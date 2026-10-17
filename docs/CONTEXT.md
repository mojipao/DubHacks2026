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

## Seed data (lane 3, live on `main`)

- `data/seed/*.json` is complete: `business.json` (a `BusinessProfile`), `products.json`, `ingredients.json`, `recipes.json`, `customers.json`, `orders.json`.
- `scripts/generate-history.ts` rewrites `orders.json` from a fixed PRNG seed, so reruns are byte-identical. `scripts/check-seed.ts` asserts the demo arithmetic and exits non-zero when it breaks; run it after touching any seed file.
- `SeedOrder` carries no status, as specced. Seed `kind: "history"` as `fulfilled` and `kind: "upcoming"` as `paid`; the committed load the counteroffer reads comes from the upcoming orders.
- `daysAgo` and `pickupDay` resolve at **seed time**, in the business timezone. `next_sun` is **`next_sat` + 1 day**, not the first Sunday after the seed date, which for a Saturday seed would be demo day itself.
- History orders are placed by offset from the seed day assuming a **Saturday seed**, so no pickup lands on a closed Monday. Seeding on another day rotates the pattern harmlessly.
- The numbers the demo depends on: butter croissant capacity 36/day, 12 committed Saturday and 6 Sunday, butter on hand covering about 30 more croissants. So 4 dozen for Saturday splits into 24 Saturday + 24 Sunday with a 3 kg butter reorder from Rainier Dairy ($38.40). Maya's usual totals $18.50 and 48 butter croissants total $216.00, which is where `planning/ARCHITECTURE.md`'s example numbers come from.
- Phone numbers never appear in `data/`; demo personas are matched by `personaKey` against `DEMO_PERSONAS` at seed time. `check-seed.ts` fails if a number or email ever lands there.

## Interfaces other agents must not break

- `packages/shared` (`@boh/shared`): the contract. Additive changes only, each with a `docs/DECISIONS.md` row.
- `supabase/migrations/0001_init.sql`: never edited after it is applied; add new migrations.
- Server HTTP API in `planning/ARCHITECTURE.md`.

## Server (lane 2, live on `main`)

- Run: `pnpm --filter @boh/server dev` (port 8787). Demo host: `pnpm demo:host` (sets `PHOTON_INBOUND=on`, `OWNER_NOTIFY=on`). Missing Photon or Square keys fall back to simulated sends and payment links (`https://simulated.invalid/pay/...`), so every route works on any laptop.
- Every route in the architecture table exists, plus: `POST /proposals/:id/retry` (failed only; reuses stored orders and payment link), `POST /dev/receive-delivery` (moves `on_order` into `on_hand`, writes `inventory.received`).
- `/dev/inbound` accepts `"handle": "owner"` for the simulator's Owner persona. `/health` shows the owner handle masked, never the number.
- `/dev/winback-scan` returns `501` until `@boh/agents` exports `runWinbackScan`. **Lane 3:** each win-back draft must list the customer in `reads` (`{ table: "customers", id }`); the server uses the first one to pick the conversation.
- Seed: `pnpm seed` (idempotent) and `pnpm reset --yes` (wipes proposals, messages, conversations, events, agent orders, and non-seed customers, then reseeds in ~6 s). `next_sun` resolves to the Sunday after `next_sat`.
- Ingredient need = that day's committed units plus the requested items, against `on_hand + on_order`. This matches lane 3's `scripts/check-seed.ts`.
- `inventory.received` is a new event type (simulated supplier delivery).

## Photon project (lane 3)

- **Project ID:** `pho_prj_01m55nwa3zesk81kyc2gb9krkj`. Shareable team config, also in the private `.env` as `PHOTON_PROJECT_ID`; point every script at this project.
- **API key:** private `.env` only, as `PHOTON_API_KEY`. Never commit it or paste it into docs.
- Shop line and owner handle: see "Demo phones and personas" above.
- Photon 2.0 beta only: dashboard `app.beta.photon.codes`, API `https://api.photon.codes/v1`, package `@photon-ai/api`. The `photon.co/beta` URL in `planning/LANE-3-AGENTS.md` step 1 is wrong.

## Photon facts verified

From the published OpenAPI spec (`https://api.photon.codes/openapi.json`, read 2026-10-17). The live round trip is still pending; `scripts/photon-ping.ts` records latency and field names here once it runs.

- **Send:** `POST /v1/projects/{id}/messages` with an `idempotency-key` **header that is required, not optional**. Body needs `spaceId`, `senderId`, `content: { type: "text", format: "plain", text }`; `parentMessageId` is optional. Success is `202`, which means accepted, not delivered.
- **Agent identity:** `receivedBy` is **optional** on a received message, and `addressedTo` is also defined. Reply from whichever is present, never from one global agent id, because agent numbers differ per sender. The ping script reports which field Photon actually populates.
- **Received iMessage fields:** `id`, `projectId`, `platform: "imessage"`, `status: "received"`, `space { id, kind, participantIds }`, `sentBy { id, handle, kind, details { type, resourceId } }`, `content { type, format, text }`, `timestamps { receivedAt }`, `createdAt`, `updatedAt`.
- **Poll shape:** `GET /v1/projects/{id}/messages` takes `createdSince`, `direction`, `platform`, `order`, `pageSize`, `spaceId`, `pageToken`. A page is `{ items: [...] }`.
- **Reactions and polls are not available on iMessage.** `ImessageMessageContent` is only `text`, `attachment`, `message.read`, `space.typing.update`, and `group`. The `reaction`/`poll` content types exist in the cross-platform union but not iMessage's, so tapback acknowledgements and native polls are off the table. **Typing indicators** (`POST /v1/projects/{id}/spaces/{spaceId}/typing`) and **read receipts** (`POST /v1/projects/{id}/messages/{messageId}/read`) are real.
- **Assignments can be released:** `DELETE /v1/projects/{id}/platforms/imessage/assignments/{assignmentId}`, and `releasedAt` is a field. The free plan's 25-assignment cap is recyclable, so `/join` can reclaim slots instead of hard-failing.
- **Rate limits** come back as `429` with `Retry-After`, plus `RateLimit` and `RateLimit-Policy` headers.

## Photon events

- Socket.IO `delivery(event, { seq, replyExpected })`. `event` is the same JSON as the webhook event (`{ id, type, ... }`). The received-message type is **`message.received`** (from Photon's OpenAPI example).
- Its full schema is only served to authenticated keys (`GET /v1/projects/{id}/webhooks/event-types/message.received/schema`), so the server reads the message from `event.data.message`, `event.data.object`, `event.data`, or `event.message`, whichever exists. Lane 3: after the ping, paste one real `message.received` event (handles redacted) here so lane 2 can pin the path.
- Message fields used (typed in `@photon-ai/api` as `ReceivedImessageMessage`): `id`, `platform: "imessage"`, `status: "received"`, `sentBy.handle`, `sentBy.kind`, `receivedBy.id` (our agent user, used as `senderId` when replying), `space.id`, `space.kind`, `content.type: "text"`, `content.text`.
- Send: `photon.projects.sendMessage({ path: { id }, headers: { "idempotency-key" }, body: { spaceId, senderId, content: { type: "text", format: "plain", text } } })`. Assign: `photon.projects.platforms.imessage.assignments.create({ path: { id }, headers: { idempotencyKey }, body: { handle } })` → `assignedPhoneNumber`.
- `subscribe({ startSeq: 0 })` starts live with no replay; a positive cursor resumes after that seq. `pnpm reset` sets the cursor to 0.
