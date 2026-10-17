# Lane 2: Backend

You build the plumbing that turns agent drafts into real-world actions: the monorepo scaffold, the database, Photon iMessage in and out, Square payment links and webhooks, and the approve-and-execute engine. You are on the critical path for the first hour. Ship the scaffold and contracts before anything else.

Read `planning/README.md` and `planning/ARCHITECTURE.md` first. The schema, shared types, API, and execution rules there are your spec.

## Ownership

| You own | You may read | Never edit |
| --- | --- | --- |
| `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.env.example`, `.gitignore` additions | `apps/web/**`, `packages/agents/**`, `data/**` | `apps/web/**` |
| `apps/server/**` | | `packages/agents/**` |
| `packages/shared/**` (creator; additive edits by others allowed) | | `data/**` (lane 3 writes the content you load) |
| `supabase/**` | | |
| `scripts/seed.ts`, `scripts/reset.ts` | | |

Claim these in `docs/STATUS.md` before writing code: set your GitHub login on lane 2, status `active`, task `scaffold + contracts`, files as above.

## What others need from you, and when

| Deliverable | Consumer | Needed by |
| --- | --- | --- |
| Scaffold, `packages/shared`, `.env.example` merged to `main` | Lanes 1 and 3 | Sat 1:15 PM, the first thing you do |
| Migration applied to the shared Supabase project | Lane 1 (live mode), seed | Sat 2:00 PM |
| `POST /dev/inbound`, `/proposals/:id/approve`, `/reject` working with the stub agent | Lane 1 | Sat 4:00 PM (M1) |
| `SupabaseDataPort` implementing `AgentDataPort` | Lane 3 integration | Sat 5:30 PM |
| Seeded database from `data/seed` | Everyone | Sat 6:00 PM |
| Photon inbound and outbound live on the demo host | Demo | Sat 9:00 PM |
| Square payment link (one link for a two-order counteroffer) and webhook; linked-set approve | `v-core` | Sat 10:30 PM (M3 at 11:00) |
| `POST /join` | Lane 1's join page, judge Guard demo | Sat 10:30 PM |
| Owner channel: notifications and Y/N commands over iMessage | Demo | Sun 1:00 AM |
| `POST /dev/winback-scan` | Stretch | Sun 3:00 AM |

## Human-only steps

Your human does these. If your human hasn't done one yet, set your row to `blocked` with the step number and keep building against stubs.

1. **Supabase.** At [supabase.com](https://supabase.com), create the project `back-of-house` (free tier, region `us-west`). From Project Settings → API, copy the project URL, the anon or publishable key, and the service role key into the shared `.env` as `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. If your agent has the Supabase MCP connected to this project, tell it so it can apply migrations directly.
2. **Square developer account.** At [developer.squareup.com](https://developer.squareup.com), create an application named `Back of House`. Open the Sandbox side. Copy the sandbox access token into `SQUARE_ACCESS_TOKEN`, and the default sandbox location ID into `SQUARE_LOCATION_ID`. Set `SQUARE_ENVIRONMENT=sandbox`.
3. **ngrok.** Create a free ngrok account and claim the free static domain. Install with `brew install ngrok` and run `ngrok config add-authtoken <token>`. The webhook URL becomes `https://<your-static-domain>/webhooks/square`. Put it in `SQUARE_WEBHOOK_URL`.
4. **Square webhook subscription.** In the Square app → Webhooks → Subscriptions (sandbox), add the URL from step 3, subscribe to `payment.created` and `payment.updated`, and copy the signature key into `SQUARE_WEBHOOK_SIGNATURE_KEY`.
5. **Owner token.** Run `openssl rand -hex 24` and set `OWNER_TOKEN` in the shared `.env`.
5a. **Owner phone.** Decide which teammate plays the bakery owner during the demo (not the one playing Maya). Put their iMessage phone in `OWNER_HANDLE`, assign that handle to the Photon line, and have them text the line "start" once so the owner conversation exists.
6. **Distribute the `.env`** privately to the other two humans once steps 1, 2, and 5 are done. Update it when Photon and LLM keys arrive from lane 3's human.
7. **Demo host.** By default your laptop is the demo host. Keep it plugged in, disable sleep during the demo (`caffeinate -dimsu` in a terminal), and bring it to judging.

## Phase 0: scaffold and contracts (target 45 minutes)

Work on `lane/2`, open a PR as soon as this phase passes, and merge it. The other lanes are waiting on it.

1. Check `node -v` reports 24 or later, then run `corepack enable`.
2. Create the root files:

   `pnpm-workspace.yaml`
   ```yaml
   packages:
     - "apps/*"
     - "packages/*"
   ```

   `package.json`
   ```json
   {
     "name": "back-of-house",
     "private": true,
     "type": "module",
     "packageManager": "pnpm@10",
     "engines": { "node": ">=24" },
     "scripts": {
       "dev": "pnpm --parallel --filter @boh/server --filter @boh/web dev",
       "typecheck": "pnpm -r typecheck",
       "seed": "tsx scripts/seed.ts",
       "reset": "tsx scripts/reset.ts"
     },
     "devDependencies": { "tsx": "^4", "typescript": "^5", "dotenv": "^16", "@types/node": "^24" }
   }
   ```
   Pin `packageManager` to the exact pnpm version `corepack` installs (`pnpm -v`).

   `tsconfig.base.json`: `target` ES2023, `module` and `moduleResolution` `Bundler`, `strict` true, `noUncheckedIndexedAccess` true, `skipLibCheck` true, `resolveJsonModule` true, `verbatimModuleSyntax` true.
3. Create `packages/shared` with `package.json` (`"name": "@boh/shared"`, `"type": "module"`, `"exports": { ".": "./src/index.ts" }`, dependency `zod@^4`, script `"typecheck": "tsc --noEmit"`), a `tsconfig.json` extending the base, and `src/index.ts` copied verbatim from `planning/ARCHITECTURE.md`.
4. Create `.env.example` listing every variable from the architecture table with empty values and a one-line comment each.
5. Create `apps/server` skeleton: `package.json` (`@boh/server`, depends on `@boh/shared: workspace:*`), `tsconfig.json`, `src/index.ts` serving `GET /health` with Hono on `PORT`. Scripts: `"dev": "tsx watch src/index.ts"`, `"start": "tsx src/index.ts"`, `"typecheck": "tsc --noEmit"`.
6. `pnpm install`, `pnpm typecheck`, `pnpm --filter @boh/server dev`, `curl localhost:8787/health`.
7. Do not create `apps/web` or `packages/agents`; those lanes create their own folders. The workspace globs pick them up.
8. Commit, push `lane/2`, open the PR titled `scaffold: workspace, shared contracts, server skeleton`, merge it (merge commit, not squash), and post in `docs/CONTEXT.md` under "Interfaces" that `@boh/shared` is live.

## Phase 1: database (by Sat 2:00 PM)

1. Save the SQL from the architecture doc as `supabase/migrations/0001_init.sql`.
2. Apply it: Supabase MCP `apply_migration` if available, otherwise paste it into the Supabase SQL editor. Confirm all tables appear and realtime is enabled for the six published tables (Database → Publications).
3. Generate types: Supabase MCP `generate_typescript_types` or `supabase gen types typescript --project-id <ref>`, saved as `packages/shared/src/db.ts`, and export it from the index as `export type { Database } from "./db.ts"`. Lane 1 uses it for typed reads.
4. Create `apps/server/src/db.ts`: a service-role Supabase client typed with `Database`.
5. Create `apps/server/src/env.ts`: load the root `.env` with `dotenv` (path resolved from `import.meta.url` to the repo root), validate with zod, and export a typed `env`. Missing optional integrations (Photon, Square, LLM) set feature flags to off instead of crashing, so the server starts on any teammate's machine.
6. Create `apps/server/src/events.ts` with `logEvent(actor, type, subject, data)`. Every later step calls it.

## Phase 2: stub loop (by Sat 4:00 PM, M1)

Goal: lane 1 can click Approve on a ticket that came from a simulated text.

1. `src/agents.ts`: if `AGENT_MODE=stub` or `@boh/agents` is not installed yet, use a stub `handleInbound` that returns one reply draft: "Hi! This is Larch & Rye. We got your message and will confirm shortly." with one evidence row, a `rationale`, a `reads` entry for the message, confidence 0.5, and two `ctx.trace` calls so lane 1 can build the trace UI against real events from day one. Once lane 3 merges, import `handleInbound` from `@boh/agents` when `AGENT_MODE=live`.
2. `src/inbound.ts`: implement the inbound handling steps from the architecture doc as one function `ingestInbound({ platform, handle, name?, text, photon? })`. Include the 4-second debounce keyed by conversation ID and supersede older pending replies.
3. `src/routes/dev.ts`: `POST /dev/inbound` calling `ingestInbound` with platform `simulated`.
4. `src/execute.ts`: approve and reject exactly as specified, with the atomic `pending → executing` update, `payload.orders` as an array (0 to 2 orders, one shared payment link), and `includeLinked` executing the parent then its children. Implement the Photon and Square calls as interfaces (`Messenger`, `Payments`) with a no-op simulated implementation now; real ones come in phases 4 and 5.
4a. When storing drafts, persist `rationale` and `reads`, write `guard.flagged` if the flags include `injection_suspected`, `off_policy`, or `abusive`, and turn each `ctx.trace` call into an `agent.step` event with the trace detail shape from the architecture doc.
5. `src/routes/proposals.ts`: the approve and reject routes, owner-token middleware, CORS for `http://localhost:3000`.
6. Test: `curl -X POST localhost:8787/dev/inbound -H "x-owner-token: $OWNER_TOKEN" -H 'content-type: application/json' -d '{"handle":"+12065550100","text":"usual for saturday?"}'`, wait 5 seconds, confirm a `pending` proposal exists, approve it, and confirm an outbound `messages` row and the events.
7. Open a PR and merge. Update your `docs/STATUS.md` handoff: "Stub loop live: run `pnpm --filter @boh/server dev`, POST /dev/inbound."

## Phase 3: data port and seed (by Sat 6:00 PM)

1. `src/data-port.ts`: `SupabaseDataPort` implementing every `AgentDataPort` method.
   - Local dates use `BusinessProfile.timezone`. Convert with `Intl.DateTimeFormat` or `date-fns-tz`; never assume the server's timezone.
   - `getDayLoad(date)`: sum `order_items.qty` by product for orders whose `pickup_at` falls on that local date and whose status is `awaiting_payment` or `paid`, joined to `products.daily_capacity`.
   - `getIngredientNeeds(items, date)`: compute recipe totals for the day's committed units plus the requested items, compare to `on_hand + on_order`, and return every ingredient involved.
   - `getOrderHistory`: newest first, default limit 12, with product names joined.
   - `getCatalog`: include `aliases`.
   - `getNextOpenDays(date, count)`: the next `count` local dates after `date` where `BusinessProfile.hours` is not null, each with its `getDayLoad`.
   - `getRegularCadences()`: per customer with at least `winbackMinOrders` orders, the median gap in days between consecutive orders, days since the last one, and whether an `imessage` conversation with a `photon_space_id` exists.
2. Load `data/seed/business.json` (lane 3 owns it) into a `BusinessProfile` at startup. Until it exists, use a hard-coded default with the same shape.
3. `scripts/seed.ts`, which must be idempotent:
   - Read `data/seed/{products,ingredients,recipes,customers,orders}.json`.
   - Apply `DEMO_PERSONAS` from the env: for each `key=+1...`, set that customer's `handle` and `is_demo_persona = true`. Real phone numbers never appear in `data/`.
   - Upsert products, ingredients, recipe lines, customers.
   - For each customer, create or reuse a Square sandbox customer (Customers API, store `square_customer_id`). Use the customer's UUID as the idempotency key.
   - Orders in `orders.json` use **relative dates** (see lane 3's `SeedOrder` type). Resolve them at seed time in the business timezone: `history` orders get `pickup_at` = `daysAgo` days before today at `pickupLocalTime`, `created_at` one day earlier, `status = 'fulfilled'`. `upcoming` orders get `pickup_at` on the first Saturday or Sunday strictly after today at `pickupLocalTime`, `status = 'paid'`. All use `source = 'history'` and totals from product prices. Square cannot backdate orders, so history lives only in our database. The UI labels it "synthetic history."
   - Because dates are relative, reseed shortly before the demo (`pnpm reset --yes`) so "41 days ago" and "this Saturday's load" are exactly as scripted.
4. `scripts/reset.ts`: delete agent-created orders, all proposals, messages, conversations, and events, then reset `ingredients.on_hand` and `on_order` from the seed and set the Photon cursor to the current latest `seq` (not 0, or old messages replay). Require `--yes`. Write a `demo.reset` event.
5. Run the seed against the shared project and announce it in `docs/STATUS.md`.

## Phase 4: Photon (by Sat 9:00 PM)

Lane 3's human proves the Photon round trip in the first hour with `scripts/photon-ping.ts`. Read their notes in `docs/CONTEXT.md` before starting. Use only the **beta** docs and the `@photon-ai/api` client.

1. Install `@photon-ai/api` (check npm for the latest 0.x; the docs used 0.5.0) and `socket.io-client`.
2. `src/photon/client.ts`:
   ```ts
   import { Photon } from "@photon-ai/api";
   export const photon = new Photon({ headers: { Authorization: `Bearer ${env.PHOTON_API_KEY}` } });
   ```
3. Find the event type. Read the AsyncAPI spec at `https://api.photon.codes/asyncapi.yaml` and identify the event emitted when a message is received, plus where its `space.id`, `sentBy`, `receivedBy`, `id`, `content`, and `platform` fields live. Write the exact event type name and field paths into `docs/CONTEXT.md` under "Photon events" on `main` immediately.
4. `src/photon/inbound.ts`, only when `PHOTON_INBOUND=on`:
   - Connect, registering listeners before `socket.connect()`:
     ```ts
     const socket = io("https://api.photon.codes", {
       path: `/v1/projects/${env.PHOTON_PROJECT_ID}/events/ws`,
       addTrailingSlash: false,
       transports: ["websocket"],
       extraHeaders: { Authorization: `Bearer ${env.PHOTON_API_KEY}` },
       autoConnect: false,
     });
     ```
   - On `connect`, emit `subscribe` with `{ startSeq: <cursor from photon_cursor> }` and a 10-second ack timeout.
   - On `delivery(event, { seq })`, process serially through a promise queue (follow the [Node.js example](https://photon.codes/docs/beta/websocket/example)). Skip `seq <= cursor`. For a received human iMessage in a direct space, call `ingestInbound` with the handle, text, `space.id`, `receivedBy.id`, and message `id`. Save the cursor to `photon_cursor` after success.
   - Ignore messages where `sentBy.kind` is not `human`, and anything sent by the agent.
   - Let Socket.IO handle reconnection. Do not add your own retry loop.
5. Polling fallback, `PHOTON_INBOUND=poll`: every 2 seconds call `photon.projects.listMessages` with `direction: "received"`, `order: "asc"`, `platform: "imessage"`, and `createdSince` from the last processed message, following page tokens. The unique `photon_message_id` makes duplicates harmless. Honor `429` retry guidance and never poll faster. Use this if the socket path fights you for more than 45 minutes.
6. `src/photon/messenger.ts`, the real `Messenger.send`:
   ```ts
   await photon.projects.sendMessage({
     path: { id: env.PHOTON_PROJECT_ID },
     headers: { "idempotency-key": `proposal:${proposalId}` },
     body: {
       spaceId: conversation.photon_space_id,
       senderId: conversation.photon_agent_user_id,
       parentMessageId,
       content: { type: "text", format: "plain", text },
     },
   });
   ```
   Mark the message `sent` when accepted. Delivery is asynchronous, so "accepted" is what we record.
7. `POST /join`: validate `handle` (E.164 phone or email), rate-limit by IP (5 per 10 minutes, in memory), upsert the customer with no history, then assign the handle. Write `customer.joined` and return `assignedPhoneNumber` as `agentNumber`. Assignments are capped at 25 on the free plan, so log the running count.
   ```ts
   const assignment = await photon.projects.platforms.imessage.assignments.create({
     path: { id: env.PHOTON_PROJECT_ID },
     headers: { idempotencyKey: `join:${handle}` },
     body: { handle },
   });
   ```
8. Test with a teammate's phone: assign the handle, text the assigned number, see the proposal, approve it, and receive the reply on the phone.

## Phase 5: Square and the linked set (by Sat 10:30 PM, for M3 at 11:00)

1. Install `square` (the current SDK exports `SquareClient` and `SquareEnvironment`; confirm on npm). Create the client with the sandbox environment and token.
2. `src/square/payments.ts`, the real `Payments.createLink(orders)`, which takes **all** orders from one reply (two for a counteroffer):
   - Call the Checkout API's create payment link with `idempotency_key` `proposal:<id>`, and an `order` containing `location_id`, `customer_id` (the Square customer ID), and ad hoc `line_items` (`name` including the pickup day, such as "Butter croissant · Sat 10/24 9:00", `quantity` as a string, `base_price_money` in cents USD) built from our server-side prices. Add a discount line when the perk applies.
   - Pass the customer's phone in `pre_populated_data.buyer_phone_number` when it is a phone number.
   - Store `payment_link.id`, `payment_link.url`, and `payment_link.order_id` on every one of our order rows from that reply.
   - Reference: [Create payment link](https://developer.squareup.com/reference/square/checkout-api/create-payment-link).
3. `POST /webhooks/square`:
   - Read the raw body with `await c.req.text()` before parsing.
   - Verify with the SDK's webhook signature helper using `SQUARE_WEBHOOK_SIGNATURE_KEY` and `SQUARE_WEBHOOK_URL`. Reject with `403` on mismatch.
   - Handle `payment.updated` (and `payment.created`) where the payment status is `COMPLETED`. Find every order of ours with that `order_id` as `square_order_id` (a counteroffer has two). Do the paid and inventory updates for all of them in one transaction (a Postgres function via `rpc` is easiest), and make it idempotent: no-op if already `paid`.
   - Return `200` within a second; do the work after responding if needed.
4. Run `ngrok http --url=<static-domain> 8787` on the demo host. Pay a link with Square's sandbox test card (see Square's sandbox testing docs for current values) and watch the order flip to paid.
5. `POST /dev/mark-paid/:orderId`: runs the same paid-and-deduct transaction without Square, for the demo fallback.
6. Reorder execution as specified (`on_order` increments), so the linked butter reorder works in `v-core`.
7. `v-core` test, run with lanes 1 and 3: simulated Jun sends "Can I get 4 dozen croissants for Saturday 9am?", two linked tickets appear, "Approve both" executes the reply (one link, two orders) and the reorder (`on_order` rises), paying the link marks both orders paid.

## Phase 6: depth (by Sun 3:00 AM, M4)

Do these in order; stop when time runs out.

1. **Owner channel** (see "Owner channel" in the architecture doc). This is the first post-`v-core` item.
   - Route inbound from `OWNER_HANDLE` to `src/owner.ts`, never to agents. Hard equality on the normalized handle.
   - On each new top-level proposal, assign a `short_code` and, if `OWNER_NOTIFY=on` and the owner conversation exists, send the templated notification. Write it with server data only: customer name, what was asked, what the plan is, server-computed totals, the code. Set `owner_notified_at` and write `owner.notified`.
   - Parse `Y [code]`, `N [code]`, `?`. Call the same executor with `includeLinked: true` and actor `owner`, with `data.via = "imessage"`. Confirm back in the owner conversation. Write `owner.command`.
   - If Phase 0 showed unprompted sends don't arrive, skip the push notification and support pull mode only (`?` lists pending).
   - Test: a customer handle texting "Y K7" must go to Intake, not approve. Put that test's output in the PR.
2. Simulate delivery with `POST /dev/receive-delivery` that moves `on_order` into `on_hand`, if lane 1 wants a button for it.
3. `POST /dev/winback-scan`: call lane 3's `runWinbackScan` if exported and store the drafts. On approval, send through Photon only if the customer has an `imessage` conversation; otherwise execute on the `simulated` platform.
3a. Perk validation: the server, not the agent, decides eligibility from the customer's last fulfilled order date.
4. Hardening: wrap each executor step in try/catch with precise `error` messages; make sure a failure in Photon after Square succeeded marks the proposal `failed` but keeps the order and link, so a retry can resend without double-charging (reuse the stored link).
5. `POST /proposals/:id/retry` for `failed` proposals, reusing stored side-effect IDs.
6. Address VEYZL findings that land in your paths. Keep the before-and-after in the PR description.

## Phase 7: demo readiness (by Sun 7:00 AM)

1. `pnpm reset --yes` works in under 10 seconds and leaves the four demo personas, their histories, this weekend's committed load, and seed stock.
2. A one-command demo host start: `pnpm demo:host` runs the server with `PHOTON_INBOUND=on` and prints the ngrok URL check. Document it in `docs/CONTEXT.md`.
3. Health check `GET /health` reports Photon socket connected, Square mode, and agent mode, so the team can check everything is live at a glance.
4. Rehearse the failure paths in `planning/DEMO-AND-SUBMISSION.md` with the team.

## Tests you must run before each PR

- `pnpm typecheck`
- The phase's curl test, pasted into the PR description with its output.
- Double-approve the same proposal concurrently; exactly one execution happens.
- Send the same Photon delivery twice; exactly one message row.
- Replay a Square webhook; the order is paid once and ingredients deducted once.
- A counteroffer reply creates two orders and exactly one payment link; paying marks both paid.
- A message from any handle other than `OWNER_HANDLE` never executes an owner command.

## Risks and fallbacks

| Risk | Fallback |
| --- | --- |
| Photon socket events are unclear | `PHOTON_INBOUND=poll` with `listMessages` |
| Photon is down during judging | Demo on `/dev/inbound` through lane 1's phone simulator; say so honestly |
| Square webhook doesn't reach the laptop | Show the paid state with a manual "mark paid" dev route; have a backup video of a real webhook |
| Supabase realtime lag | Lane 1 also polls every 3 seconds as a fallback |
| Shared database chaos from three developers | Agree on reset times in `docs/STATUS.md`; personas are reseeded by `pnpm reset` |

## When you stop

Update your `docs/STATUS.md` row with: which phase is done, the exact commands to run the server, what is stubbed, and any facts added to `docs/CONTEXT.md`. Push to `main`.
