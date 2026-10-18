# Project context

Agents: read this file after `AGENTS.md` and before writing code. If you change a fact below, update it here and add a row to `docs/DECISIONS.md` in the same commit.

## Status

- **Product:** Back of House. An operations agent for small food businesses. Customers text the shop on iMessage through Photon; agents read the shop's customers, orders, capacity, and stock to propose replies, Square payment links, and supplier reorders, including counteroffers when a request can't be met as asked; nothing goes out until the owner approves it in the live control room or by replying to an iMessage.
- **`v-core` scope (Sat 11 PM):** real-phone order and payment loop, the 4-dozen-milk-cake counteroffer with a linked ghee reorder, the agent trace, deterministic Guard flags, and the friction saved counter. See `planning/README.md`.
- **Demo business:** **Mokha Coffee House**, a fictional Seattle Yemeni coffee house (2026-10-17: Larch & Rye bakery → Kettle & Crow Coffee → Mokha Coffee House; see `docs/DECISIONS.md`). Menu: milk cake, pistachio maamoul, bint al-sahn, sabaya, sesame kaak, malawah; Yemeni coffee (Haraz), Adeni chai, qishr, Mokha latte, cold brew, coffee box, beans. All data synthetic. Demo numbers unchanged: Sat 12/36 milk cakes committed, 48 → 24 Sat + 24 Sun with a 3 kg ghee reorder ($38.40), Maya's usual $18.50 (2 pistachio maamoul + Adeni chai), Jun's 48 = $216.00.
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

**Secrets status (2026-10-17, 16:20, demo host):** set: Photon (`PHOTON_PROJECT_ID`, `PHOTON_API_KEY`, `PHOTON_AGENT_HANDLE`, `PHOTON_TEST_SENDER`), `OWNER_HANDLE`, Square sandbox (`SQUARE_*`, verified live with a signed webhook), `AI_GATEWAY_API_KEY` (verified live), `SUPABASE_SERVICE_ROLE_KEY`. `AGENT_MODEL` is empty on purpose; the agents default to `google/gemini-2.5-flash-lite`. **Still not filled:** `DEMO_PERSONAS` (waiting on who texts as Maya). Do not invent values.

## Workspace (live on `main`)

- pnpm workspace with `apps/*` and `packages/*`. Install pnpm 10 (`npm i -g pnpm@10`; old corepack versions fail pnpm's signature check), then `pnpm install` at the root.
- `@boh/shared` is live. Depend on it with `"@boh/shared": "workspace:*"`. Next.js needs `transpilePackages: ["@boh/shared"]`.
- `@boh/server`: `pnpm --filter @boh/server dev`, then `curl localhost:8787/health`. Runs with no keys; missing integrations show as `unconfigured`.
- `@boh/web` (lane 1): Next.js control room under `apps/web` on branch `lane/1` (Phase 1 mock UI). Run `pnpm --filter @boh/web dev`. Vercel is connected to this GitHub repo; set Root Directory to `apps/web` and the web env vars from the architecture table.
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
- The numbers the demo depends on: milk cake capacity 36/day, 12 committed Saturday and 6 Sunday, ghee on hand covering about 30 more milk cakes. So 4 dozen for Saturday splits into 24 Saturday + 24 Sunday with a 3 kg ghee reorder from Rainier Dairy ($38.40). Maya's usual totals $18.50 and 48 milk cakes total $216.00, which is where `planning/ARCHITECTURE.md`'s example numbers come from.
- Phone numbers never appear in `data/`; demo personas are matched by `personaKey` against `DEMO_PERSONAS` at seed time. `check-seed.ts` fails if a number or email ever lands there.

## Interfaces other agents must not break

- `packages/shared` (`@boh/shared`): the contract. Additive changes only, each with a `docs/DECISIONS.md` row.
- `supabase/migrations/0001_init.sql`: never edited after it is applied; add new migrations.
- Server HTTP API in `planning/ARCHITECTURE.md`.

## Server (lane 2, live on `main`)

- **Autonomy is on by default** (`AUTONOMY=on|off`; see `docs/DECISIONS.md`). Plain answers go out without the owner (`via: "agent"`); orders get a data-only customer check-in ("Reply YES"), then land on the pass for the owner. Orders, payment links, and reorders always need the owner. Demo scripts and pitch lines that say "nothing goes out without the owner" should say "no order or payment goes out without the owner".
- Product facts (size, ingredients, allergens) live in `data/seed/product-facts.json`, keyed by product id, read by the order check-in and the voice tools.
- Owner assistant: `POST /assistant/ask` (stock, previewed customer texts, calls), `POST /assistant/campaigns/send`, `POST /assistant/calls/sync`; `POST /conversations/:id/send` for the owner's own message. Owner token. Owner texts that aren't Y/N/? go to the same assistant.
- Finished ElevenLabs calls are polled every 20 s (needs `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`) and land as messages plus a `call.transcribed` event.

- Run: `pnpm --filter @boh/server dev` (port 8787). Demo host: `pnpm demo:host` (sets `PHOTON_INBOUND=on`, `OWNER_NOTIFY=on`). Missing Photon or Square keys fall back to simulated sends and payment links (`https://simulated.invalid/pay/...`), so every route works on any laptop.
- **Square sandbox verified live** (payment link, signed webhook through ngrok, split orders paid together). Sandbox links can't be paid in a browser; `POST /dev/square-pay/:orderId` pays the link's order for real (see `docs/SQUARE-SANDBOX.md` step 8).
- `pnpm seed` without `DEMO_PERSONAS` no longer clears persona phones another machine set.
- **Web on Vercel:** team DubHacks26, project `dub-hacks2026`, root `apps/web`, auto-deploys from this repo; production URL `https://dub-hacks2026.vercel.app`. Preview env vars are set; production ones need the team owner (see NOTES).
- **Human in the loop:** approve sends immediately; `POST /proposals/:id/approve { alternativeIndex }` sends one of the agent's alternative wordings (`ReplyPayload.alternatives`, optional, up to 3); `POST /conversations/:id/send { text, clientId }` sends the owner's own message, closes pending agent replies there, and the agents read it on the next text. Owner token.
- **Voice tools (ElevenLabs → server):** `POST /voice/tools/availability` (live menu, prices, per-day capacity, stock; weekday names mean the next one, like the agents) and `POST /voice/tools/order` (runs `handleVoiceTurn`, the ticket lands on the pass). Header `x-voice-secret: $VOICE_TOOL_SECRET`. Both are registered on the ElevenLabs agent as `check_availability` and `place_order`, pointing at the ngrok URL, with the secret in ElevenLabs' secret store. Voice conversations use platform `simulated` until a migration adds `voice`.
- **Leads:** `GET /contacts` (stage, money, counts per conversation; `?format=csv` to export) and `GET /contacts/:conversationId/messages` (paged full history). Owner token.
- Every route in the architecture table exists, plus: `POST /proposals/:id/retry` (failed only; reuses stored orders and payment link), `POST /dev/receive-delivery` (moves `on_order` into `on_hand`, writes `inventory.received`).
- `/dev/inbound` accepts `"handle": "owner"` for the simulator's Owner persona. `/health` shows the owner handle masked, never the number.
- `/dev/winback-scan` returns `501` until `@boh/agents` exports `runWinbackScan`. **Lane 3:** each win-back draft must list the customer in `reads` (`{ table: "customers", id }`); the server uses the first one to pick the conversation.
- Seed: `pnpm seed` (idempotent) and `pnpm reset --yes` (wipes proposals, messages, conversations, events, agent orders, and non-seed customers, then reseeds in ~6 s). `next_sun` resolves to the Sunday after `next_sat`.
- Ingredient need = that day's committed units plus the requested items, against `on_hand + on_order`. This matches lane 3's `scripts/check-seed.ts`.
- `inventory.received` is a new event type (simulated supplier delivery).
- Before validating agent drafts, the server completes a zone-less `neededBy` or `pickupAt` (`"2026-10-23T07:00"`) in the business zone and logs an `agent.step` with `step: "normalize"`. A safety net, not the contract: agents should still emit full ISO times.

## Photon project (lane 3)

- **Project ID:** `pho_prj_01m55nwa3zesk81kyc2gb9krkj`. Shareable team config, also in the private `.env` as `PHOTON_PROJECT_ID`; point every script at this project.
- **API key:** private `.env` only, as `PHOTON_API_KEY`. Never commit it or paste it into docs.
- Shop line and owner handle: see "Demo phones and personas" above.
- Photon 2.0 beta only: dashboard `app.beta.photon.codes`, API `https://api.photon.codes/v1`, package `@photon-ai/api`. The `photon.co/beta` URL in `planning/LANE-3-AGENTS.md` step 1 is wrong.

## Model and the AI Gateway

- **Who serves what:** Photon carries iMessages and runs no model. The Vercel AI Gateway routes model calls and runs no model of its own; it resells providers at list price. The model id names the provider that actually serves it, so `google/gemini-2.5-flash-lite` is served by Google. Swapping models is a one-line `.env` change.
- **Verified 2026-10-18: the gateway's free tier rate-limits us out of the model entirely.** After an eval run, every call returns `429 rate_limit_exceeded` with `retry-after: 60`. A single call still succeeds in about 700 ms, so the limit is on sustained use, not on the key.
- What that costs: the agents fall back to the deterministic reader, which only knows English aliases. Typos, Spanish, and rambling messages stop resolving. `packages/agents/src/eval.ts` prints model participation for this reason — measured over 34 cases, both `deepseek/deepseek-v3.1` and `google/gemini-2.5-flash-lite` answered **0 of 34** while still scoring 88.2%, because the fallback caught every one. A pass rate alone hides a model that never answers.
- **The fix is paid credits, not a better model.** Purchasing any amount moves the team to the paid tier, which raises the rate limits and unlocks the full catalog; no Anthropic model is on the free tier at all. The demo is a burst of messages (Maya, Jun, then judges), which is exactly the pattern that trips the limit.

## Photon facts verified

**Unprompted sends work (2026-10-18, verified on a handset).** A message sent into an existing space **2 minutes after** the customer's last inbound, with nothing triggering it, was **delivered to the phone**. So a shared line *can* message an open conversation on its own.

What that unblocks, both previously at risk:
- **Owner approval by iMessage.** The server can push "Jun wants 48 milk cakes… Reply Y K7" to the owner's space. The owner must have texted the line once first, so that space exists.
- **The win-back scan.** A drafted win-back can actually reach a customer who has an open conversation.

Still true: a shared line **cannot start** a conversation. The other party must have texted first. So win-back reaches customers with an existing space and nobody else, and `RegularCadence.hasOpenConversation` is the field that decides which. A 15-minute gap is under test; if it fails, the owner channel falls back to pull mode (the owner texts `?` and gets the pending list as a reply).

**Round trip proven end to end (2026-10-18, project `dubhack`).** A text from a teammate's phone reached the project and a reply was delivered back to the handset.

- **Latency:** inbound appeared in `listMessages` about 1.8 s after `timestamps.receivedAt`. Outbound accepted (`202 dispatched`) in well under a second.
- **A send must not carry `parentMessageId`.** A shared iMessage line rejects threaded replies with `409 SPACE_NOT_SENDABLE` — *"Replies are not supported for this Space"* — which reads like the space itself is unsendable. It is not: the identical send without `parentMessageId` returns `202`. Verified both ways back to back. The field is valid in the API and on other platforms, just not on a shared iMessage line.
- **Exact shape of a received message** (redacted), confirming the earlier spec reading:
  `content: { format: "plain", text: "ping", type: "text" }`, `metadata: { transport: "imessage" }`, `platform: "imessage"`, `status: "received"`, `space: { kind: "direct", participantIds: [human, agent] }`, `sentBy: { kind: "human", details: {} }`, `receivedBy: { kind: "agent", details: { type: "shared" } }`, `timestamps: { receivedAt }`.
- **`receivedBy` is present and `addressedTo` is absent**, so `receivedBy.id` is the sender identity to reply from. Its `details.type` is `"shared"`.
- Message ids are `pho_msg_…`, spaces `pho_spc_…`, users `pho_usr_…`.

**Observed on a real inbound iMessage (2026-10-17, project `dubhack`).** A text from a teammate's phone reached the project and came back from `listMessages` with:

- `platform: "imessage"`, `status: "received"`, `space.kind: "direct"`, `content.type: "text"`, `content.format: "plain"`, `sentBy.kind: "human"`, `timestamps.receivedAt` set.
- **`receivedBy` present, `addressedTo` absent.** So `receivedBy.id` is the agent identity to reply from, and the `addressedTo` fallback is a safety net rather than the primary path. The OpenAPI spec marks `receivedBy` optional, which is why the fallback is still worth keeping.
- One live shared-line assignment; the assigned agent number matched `PHOTON_AGENT_HANDLE` exactly, and `handle` matched the sending phone.

**Still unproven:** the outbound half. No message has been sent from this project yet (`direction=sent` returns nothing), so reply latency and the unprompted follow-up question are both still open. `scripts/photon-ping.ts --followup` answers them.

The rest below is from the published OpenAPI spec (`https://api.photon.codes/openapi.json`, read 2026-10-17).

- **Send:** `POST /v1/projects/{id}/messages` with an `idempotency-key` **header that is required, not optional**. Body needs `spaceId`, `senderId`, `content: { type: "text", format: "plain", text }`; `parentMessageId` is optional. Success is `202`, which means accepted, not delivered.
- **Agent identity:** `receivedBy` is **optional** on a received message, and `addressedTo` is also defined. Reply from whichever is present, never from one global agent id, because agent numbers differ per sender. The ping script reports which field Photon actually populates.
- **Received iMessage fields:** `id`, `projectId`, `platform: "imessage"`, `status: "received"`, `space { id, kind, participantIds }`, `sentBy { id, handle, kind, details { type, resourceId } }`, `content { type, format, text }`, `timestamps { receivedAt }`, `createdAt`, `updatedAt`.
- **Poll shape:** `GET /v1/projects/{id}/messages` takes `createdSince`, `direction`, `platform`, `order`, `pageSize`, `spaceId`, `pageToken`. A page is `{ items: [...] }`.
- **Reactions and polls are not available on iMessage.** `ImessageMessageContent` is only `text`, `attachment`, `message.read`, `space.typing.update`, and `group`. The `reaction`/`poll` content types exist in the cross-platform union but not iMessage's, so tapback acknowledgements and native polls are off the table. **Typing indicators** (`POST /v1/projects/{id}/spaces/{spaceId}/typing`) and **read receipts** (`POST /v1/projects/{id}/messages/{messageId}/read`) are real.
- **Assignments can be released:** `DELETE /v1/projects/{id}/platforms/imessage/assignments/{assignmentId}`, and `releasedAt` is a field. The free plan's 25-assignment cap is recyclable, so `/join` can reclaim slots instead of hard-failing.
- **List responses do not share a key.** Messages come back under `items` (`MessagePage`), shared-line assignments under `assignments` (`SharedLineAssignmentPage`). Reading the wrong one and defaulting to `[]` silently reports "no assignments", which looks like an unassigned phone rather than a parsing bug.
- **Rate limits** come back as `429` with `Retry-After`, plus `RateLimit` and `RateLimit-Policy` headers.

## Photon events

- Socket.IO `delivery(event, { seq, replyExpected })`. `event` is the same JSON as the webhook event (`{ id, type, ... }`). The received-message type is **`message.received`** (from Photon's OpenAPI example).
- **Full round trip verified on a real phone (2026-10-17, lane 2):** inbound over the socket, reply with a real Square link delivered, and an **unprompted** owner notification delivered (the owner had texted the line first). Owner `Y <code>` by text executed a counteroffer.
- **Sender identity gotcha:** iMessage can send from the Apple ID email or a second SIM instead of the assigned number. Apple then says "Delivered" but Photon drops it silently: no message, no space, no error. Fix on the phone: Settings → Apps → Messages → Send & Receive → "Start new conversations from" the assigned number, then start a fresh conversation. Tell judges this at `/join`.
- **Confirmed on a live delivery (2026-10-17, API version `2026-07-01`):** the message is at `event.data.object`. The envelope is `{ id, apiVersion, type, source, timestamp, data: { object, projectId } }`. Deliveries carry large `seq` values (the first was 6196), so never compare against a hard-coded cursor.
- Message fields used (typed in `@photon-ai/api` as `ReceivedImessageMessage`): `id`, `platform: "imessage"`, `status: "received"`, `sentBy.handle`, `sentBy.kind`, `receivedBy.id` (our agent user, used as `senderId` when replying), `space.id`, `space.kind`, `content.type: "text"`, `content.text`.
- Send: `photon.projects.sendMessage({ path: { id }, headers: { "idempotency-key" }, body: { spaceId, senderId, content: { type: "text", format: "plain", text } } })`. Assign: `photon.projects.platforms.imessage.assignments.create({ path: { id }, headers: { idempotencyKey }, body: { handle } })` → `assignedPhoneNumber`.
- `subscribe({ startSeq: 0 })` starts live with no replay; a positive cursor resumes after that seq. `pnpm reset` sets the cursor to 0.
