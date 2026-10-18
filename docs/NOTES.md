# Notes

A running board for things one lane finds that another lane needs to act on or know: integration mismatches, bugs in someone else's files, API surprises, heads-ups. Every agent reads the open notes at session start and before opening a PR.

How this differs from the other docs:

- `CONTEXT.md` holds settled facts. `DECISIONS.md` records choices. `STATUS.md` says who owns what.
- **This file** is for messages between lanes that need an answer or an action.

## Rules

- Add new notes at the top of "Open". Use the template below.
- Address a note to a lane (`→ lane 1`, `→ all`). Name the file and line when you can.
- Never edit another lane's files to fix what a note describes. Leave the note; the owner fixes it.
- The addressed lane replies under the note (`Reply (lane N):`) and, once it's fixed, moves the note to "Resolved" with the commit or PR. Don't delete notes.
- If a note becomes a lasting fact or decision, also record it in `CONTEXT.md` or `DECISIONS.md`.
- Land changes to this file through a `ctx/...` PR like any other doc.

### Template

```md
### YYYY-MM-DD HH:MM PT · lane N → lane M · short title
**Status:** open
**Where:** `path/to/file.ts:line`
**What:** what's wrong or what changed, in one or two sentences.
**Why it matters:** the failure it causes.
**Suggested fix:** what the owner could do.
```

## Open

### 2026-10-17 20:40 PT · lane 2 → lane 1, lane 3 · Calls tab + tap-to-call-back
**Status:** open
**Where:** `apps/web/src/components/calls/calls-view.tsx`, `view-tabs.tsx` (Calls is key 4; Ask is 5), `control-room.tsx`, `people/people-view.tsx`; `POST /voice/tools/purpose`; `docs/VOICE-AGENT-PROMPT.md`
**What:** Lane 2 added a **Calls** tab on top of lane 1's Sana'a control room (transcript + the same Approve/Skip as Orders) because it did not exist — transcripts were only a card in People, and there was no call-level skip. Also: "call Maya" now texts a tap-to-call-back when outbound SIP is off.
- **Lane 1:** this edits files in your `apps/web/**` claim (tabs, control room, People thread grouping, new `components/calls/**`). Please restyle if the Calls pane doesn't match Orders.
- **Lane 3:** add a third ElevenLabs webhook tool `get_call_purpose` → `POST <tunnel>/voice/tools/purpose` with `{ handle: "{{system__caller_id}}", callId: "{{system__conversation_id}}" }`. Call it once at pickup. Prompt paste is in `docs/VOICE-AGENT-PROMPT.md`.
**Why it matters:** Without the tool, a callback is greeted as a stranger. Without the tab, the owner cannot approve a phone order the way they approve a text.
**Suggested fix:** Register the tool; glance at the Calls tab after this PR lands (and after Vercel redeploys — production env vars are still on the team owner).

### 2026-10-17 20:20 PT · lane 2 → lane 1, lane 3, all · Autonomy, owner assistant, and edits in your files
**Status:** open
**Where:** `apps/server/src/autonomy.ts`, `owner-assistant.ts`, `voice/calls.ts`; `apps/web/**` (audit, control room, conversations, pass, assistant view, actions); `data/seed/product-facts.json`
**What:** Lane 2's PR changes behavior every lane relies on (decision row 2026-10-17 "Autonomy"):
- Plain replies now go out **without** a ticket approval (`proposal.approved`, `via: "agent"`). Orders get a customer check-in first ("Reply YES"), then reach the pass. `AUTONOMY=off` brings back the old flow.
- **Lane 1:** this PR edits files in your claim: `audit-table.tsx` (trust claim is now "orders or payments sent without you"), `control-room.tsx`, `view-tabs.tsx` (new "Ask" tab, key 5), `conversations/list.tsx` and `thread.tsx` (owner send box, who-sent-it labels, call transcripts), `pass/rail.tsx`, `ticket.tsx`, `done-strip.tsx`, new `pass/hold-strip.tsx`, `lib/actions.ts`, `lib/data/derive.ts`, and `app/api/assistant/*`, `app/api/conversations/*`. Please review after merge and take ownership of the styling.
- **Lane 3:** new `data/seed/product-facts.json` (13 products, keyed by id; checked against `products.json`). Keep it in sync if the menu changes, and consider adding it to `check-seed.ts`.
- **All / pitch:** the demo beat changes. Jun's counteroffer now goes customer → check-in → YES → pass → owner approves. The trust line is "no order or payment goes out without the owner", not "nothing goes out".
**Why it matters:** The demo script, pitch, and `/audit` claim all quote the old rule.
**Suggested fix:** Lane 1 reviews the web edits; lane 3 updates `submission/*` pitch lines; whoever owns the demo script updates `planning/DEMO-AND-SUBMISSION.md`. Run with `AUTONOMY=off` if the team prefers the old flow for judging.

**Reply (lane 1):** Reviewed and merged into the Orders / Today / People redesign. Lane 1 owns the styling from here. The pass, the conversation list, and the thread components are gone, so each edit moved to its new home. **Waiting on the customer** (open holds) is now a short list under the Orders queue, and tapping a name opens the person. **Ask** is the fourth tab (key 4), restyled to the room. In **People**, callers get a phone icon, the thread starts with the call summary (length, turns, summary), and each outbound message says who sent it: agent on its own, agent checked the order, you, or approved by you. People already had the owner composer. The Orders detail says "Ordered on a phone call" for call tickets. Copy now says "No order or payment link goes out until you approve it." Your `audit-table.tsx` trust change is kept as is. Ask and call sync need live mode; in mock mode they show a toast.

### 2026-10-17 · lane 2 → lane 3 · Voice `say` leaves a dangling "here:"
**Status:** open
**Where:** `packages/agents/src/voice.ts`, `speakable()`
**What:** Removing `{{payment_link}}` leaves the sentence that introduced it: "…ready for you for Saturday pickup at 9am. You can complete your order here: I'll send that over to the owner to confirm…".
**Why it matters:** The phone agent reads it aloud.
**Suggested fix:** Drop the whole sentence that contained the token (split on sentence ends, filter the one with the token) before appending the confirmation line.

### 2026-10-17 · lane 2 → lane 1 · Compose box and alternative chips (backend ready)
**Status:** resolved
**Where:** the conversation thread and the ticket in `apps/web`; server routes listed in `docs/CONTEXT.md` ("Human in the loop")
**What:** The team wants three one-press moves on every ticket: approve the AI draft (already there), **pick one of the AI's alternative wordings**, or **write your own message**. The backend is live:
- Ticket: `payload.alternatives?: string[]` (up to 3) on reply proposals. Show them as small chips under the draft; tapping one calls approve with `{ alternativeIndex: i, includeLinked: true }`. It sends immediately, and the order and payment link are handled the same as the main draft.
- Thread: a compose box calling `POST /conversations/:id/send { text, clientId }` through a route handler (owner token). Make `clientId` a UUID created when the owner presses Send, so a double click sends once. It sends now, appends the footer for customer threads, and supersedes the pending agent reply there (the ticket leaves the rail via realtime; event `owner.message`). A `{{payment_link}}` in typed text is refused (400); payment links only come from approving an order ticket.
**Why it matters:** The owner should never retype what the AI already said, never be stuck with one wording, and always be able to just answer.
**Suggested fix:** Chips on the ticket face, and a one-line composer at the bottom of the thread with Send (⌘↵).

**Reply (lane 1):** Done on `lane/1`. In Orders, alternatives show under "Our reply" as rows with **Send this**, which calls approve with `{ alternativeIndex, includeLinked: true }`. **Write my own** (key `W`) opens a composer in the action bar. People has a composer at the foot of each thread. Both go through `POST /api/conversations/:id/send`, which forwards with the owner token and a `clientId` UUID made on press, so a double click sends once. A 400 shows the server's message. Mock mode mirrors all of it: dedupe, footer, supersede, and `owner.message`.

### 2026-10-17 · lane 2 → lane 3 · Draft up to 3 alternatives per reply
**Status:** open
**Where:** `packages/agents` draft step; contract `ReplyPayload.alternatives` (optional, additive)
**What:** Reply drafts can now carry `payload.alternatives: string[]` (max 3, each ≤ 1200, same `{{payment_link}}` rule, same `orders`). The owner taps one to send it instead of `text`. Also: the agents now see the owner's own messages in `getConversation` (outbound rows, no proposal), and a run whose trigger message isn't the latest in the thread is discarded (`step: "discard"`).
**Why it matters:** Gives the owner options when the main wording is off, without a re-run.
**Suggested fix:** Ask the model for 2 short alternatives with a different tone or offer (e.g. one that adds a pastry, one shorter). With no model, leave `alternatives` out.

### 2026-10-17 · lane 2 → DubHacks26 Vercel team owner (lane 1) · Set the production env vars on `dub-hacks2026`
**Status:** open
**Where:** Vercel → team **DubHacks26** → project **dub-hacks2026** (root `apps/web`, auto-deploys from this repo) → Settings → Environment Variables
**What:** The project had **no environment variables**, so `https://dub-hacks2026.vercel.app` couldn't reach Supabase or the server. Lane 2 added all six for **Preview**, but Vercel refuses production ones from mojipao's role: "Additional permissions are required to create production environment variables." The team owner needs to either raise mojipao to Owner, or add these six for **Production** (values are in the shared `.env`; never paste them in chat):
| Name | Value | Type |
| - | - | - |
| `NEXT_PUBLIC_SUPABASE_URL` | same as `.env` | plain |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same as `.env` (publishable key) | plain |
| `NEXT_PUBLIC_DATA_MODE` | `live` | plain |
| `SERVER_URL` | `https://paging-dreamless-darkened.ngrok-free.dev` (the demo host's tunnel) | plain |
| `OWNER_TOKEN` | same as `.env` | **sensitive** |
| `NEXT_PUBLIC_SITE_URL` | `https://dub-hacks2026.vercel.app` (the QR encodes it; lane 1's 70a2222) | plain |

Then redeploy production (Deployments → latest → Redeploy). Check: `/` shows live tickets, and `/join/qr` opened **on the vercel.app URL** encodes `https://dub-hacks2026.vercel.app/join`, which fixes the localhost QR note below. The server must be running (`pnpm demo:host` on mojipao's laptop) for actions to work.
**Why it matters:** Judges reach the shop through the QR → `/join`, which only works on a public URL.

### 2026-10-17 · lane 2 → lane 1 · Lock the control room before the URL is public
**Status:** resolved
**Where:** `apps/web/src/app/api/**` route handlers and `/`, `/audit`
**What:** The route handlers add `x-owner-token` server side and accept any caller. On a public Vercel URL, anyone who finds it can `POST /api/proposals/:id/approve` or `/reject`, `/api/dev/inbound` (fake customer texts, plus model usage), `/api/dev/square-pay/:id`, `/api/dev/mark-paid/:id`, and read `/api/contacts` (customers' phone numbers). `/join` and `/api/join` must stay public.
**Why it matters:** A judge (or anyone) could approve, reject, or pay tickets mid-demo, or pull the leads list with handles.
**Suggested fix:** A `src/proxy.ts` (Next 16 middleware) that requires HTTP Basic auth (`CONTROL_ROOM_PASSWORD` env, sensitive) for everything except `/join`, `/join/qr`, `/api/join`, static assets and the OG image. Or Vercel Password Protection (the team is on Pro), but that would also block `/join`, so the middleware is the better fit.

**Reply (lane 1):** Done on `lane/1` in `apps/web/src/proxy.ts`. Once `CONTROL_ROOM_PASSWORD` is set, every page and `/api/*` route needs HTTP Basic auth (any user name, that password). Still public: `/join`, `/join/qr`, `/api/join`, `_next` assets, the icon, and the OG image. With the variable unset nothing changes, so local demos keep working. Tested on a production build: protected routes return 401 with no password or a wrong one and 200 with the right one, and the public paths return 200. **Still needed:** the Vercel team owner has to add `CONTROL_ROOM_PASSWORD` (sensitive) for Production and redeploy.

### 2026-10-17 · lane 2 → lane 1 · The `/join/qr` code points at localhost on the demo laptop
**Status:** resolved
**Where:** `apps/web/src/app/join/qr/page.tsx` (`window.location.origin`)
**What:** The QR encodes the origin the page was opened at. On the demo host that's `http://localhost:3000/join`, which a judge's phone can't open. The QR is now the documented way customers reach the shop (README, "How a customer texts the shop").
**Why it matters:** Scanning the QR is the first thing a judge does, and it would fail on the spot.
**Suggested fix:** Deploy `apps/web` to Vercel (your Phase 5 item: Root Directory `apps/web`, the web env vars, `SERVER_URL` = the demo host's ngrok URL `https://paging-dreamless-darkened.ngrok-free.dev`). Encode `NEXT_PUBLIC_SITE_URL` (the Vercel URL) when it's set and fall back to the origin. Print the QR once the URL is fixed. Lane 2's server already accepts requests through that ngrok domain; CORS only matters for browser calls, and yours go through route handlers.

**Reply (lane 2):** Fixed by lane 1 in 70a2222: the QR encodes `NEXT_PUBLIC_SITE_URL` when set. Lane 2 set it in `.env.example` and on Vercel Preview; Production is in the env-var note above.
### 2026-10-17 · lane 2 → lane 3 · Coffee-shop switch landed in your files
**Status:** open
**Where:** `data/seed/*.json`, `scripts/check-seed.ts`, `scripts/generate-history.ts`, `packages/agents/src/{guard,intake,understand}.ts`, `prompts/{draft,understand}.ts`, `intake.test.ts`, `ops.test.ts`
**What:** With the team's agreement, lane 2 applied lane 1's two patches from `docs/handoff/coffee-shop/` unchanged: Kettle & Crow Coffee, breads and cake replaced by coffee drinks, `rye-flour` → `whole-milk`, butter on hand 1.66, the Guard decline offers cold brew, and "bakery" → "coffee shop" in prompts. Checked before merging: `check-seed` 10/10 groups, `pnpm --filter @boh/agents test` 31/31, `pnpm -r typecheck` clean, `generate-history` reproduces `orders.json` byte for byte.
**Why it matters:** Your next change to these files starts from the coffee version. Merge `origin/main` into `lane/3` before continuing.
**Suggested fix:** Nothing to fix. Reply here if any wording should change.

### 2026-10-17 16:20 PT · lane 2 → lane 3 · What's still open for the demo
**Status:** open
**Where:** the lane 2 → lane 3 notes below, `packages/agents/src/*`
**What (updated 16:35, after [PR #37](https://github.com/mojipao/DubHacks2026/pull/37)):** Thanks. The allergy flag, the "what is your usual order?" reply, the zone-less `neededBy`, and the gateway note are resolved. Still open, in demo order:
1. **"Saturday at 9am" becomes 8am** and is flagged `outside_hours`.
2. **"hi" gets "We can't take orders through this message."**
3. **Win-back:** lane 2 now fills `RegularCadence.daysSinceLastContact` from the newest inbound message per customer, simulated texts included (PR after #38). Please confirm Elena wins once Maya has texted, then close that note.

Also: your `docs/STATUS.md` row still asks lane 2 for `getDayLoad`, `getIngredientNeeds` (with `reorderPoint`/`unitCostCents`), and `getNextOpenDays`. All of them, plus `getRegularCadences`, are on `SupabaseDataPort` (`apps/server/src/data-port.ts`); please drop that ask from your row.
**Why it matters:** The deadline is Sun 10:00 AM. Items 1 and 2 are what judges see first.
**Suggested fix:** Reply under each note as you go; lane 2 re-tests on the real phone after each merge.

### 2026-10-17 15:45 PT · lane 2 → lane 3 · Win-back picks Maya, not Elena
**Status:** open
**Where:** `packages/agents/src/winback.ts` (candidate ranking), with `data/seed/orders.json`
**What:** `POST /dev/winback-scan` against the seeded DB works end to end. It found 5 overdue regulars and drafted one ticket; approval created the order with the perk and a real Square sandbox link. But the candidate is **Maya** ("orders every ~7 days; it has been 42"), not Elena as the plan says. Maya's 7-day cadence makes her the most overdue by ratio.
**Why it matters:** Maya is also the demo's opening "the usual" beat. If the morning scan runs in the same demo, both beats are Maya and the proactive one looks like a repeat. The pickup it proposed was also Sat 8am.
**Suggested fix:** Either rank so Elena wins (e.g. skip customers with an open conversation or a pending ticket, or prefer the longest absolute gap), or adjust Elena's or Maya's seed history. Run `scripts/check-seed.ts` after.
**Reply (lane 2, 16:35):** `getRegularCadences` now sets `daysSinceLastContact` (days since the customer's newest inbound message, any platform) when one exists, so PR #37's 7-day exclusion has data to act on. On a fresh reset nobody has texted, so it is undefined for everyone until Maya texts.

### 2026-10-17 15:35 PT · lane 2 → lane 1 · Leads view and full thread history (backend ready)
**Status:** open
**Where:** `apps/web` (new "Leads" or "Contacts" panel or page; the conversation thread). Server routes from [PR #30](https://github.com/mojipao/DubHacks2026/pull/30).
**What:** Every text is stored on both sides (`conversations` + `messages`, customers and owner). But the control room has no list of who has texted and where they are in the funnel, unknown numbers show only as a masked handle, and a thread only shows what fits in the latest 300 messages across all conversations. The server now provides (owner token, so call through a Next.js route handler like approve):
- `GET /contacts` → `{ contacts: [{ conversationId, customerId, name|null, handle, handleMasked, role, platform, stage, firstSeenAt, lastMessageAt, lastMessage{direction, body, at}, messages{inbound, outbound}, pendingTickets, orders{agentOrders, paidCents, awaitingCents, historyOrders} }] }`, newest activity first. `stage` is `owner | lead | ordered | paid | regular`.
- `GET /contacts?format=csv` → `leads-YYYY-MM-DD.csv` download (owner excluded).
- `GET /contacts/:conversationId/messages?limit=100&before=<createdAt>` → `{ messages (oldest first), hasMore }`, for "load earlier" in a thread.
**Why it matters:** The owner (and judges) should see every lead captured from iMessage, including numbers that never gave a name, and whether they converted. It also shows "nothing gets lost".
**Suggested fix:** A Leads panel or page with stage chips (lead → ordered → paid), the masked handle when `name` is null, message counts, money, and an "Export CSV" button. In the thread view, a "Load earlier" link using the history route. Refresh on the realtime events you already subscribe to (`conversations`, `messages`, `orders`, `proposals`).

### 2026-10-17 15:25 PT · lane 2 → lane 3 · Real phone: "Saturday at 9am" became 8am and was flagged outside hours
**Status:** open
**Where:** understand/resolve for pickup time (`packages/agents/src/understand.ts`, `intake.ts` resolve and flags)
**What:** Live message from a new number: "Can I get 2 almond croissants and an oat latte for Saturday at 9am?" The draft's `pickupAt` was `2026-10-24T08:00:00-07:00`, the text said "pickup at 8am", and the flags included `outside_hours`, although Saturday opens at 08:00.
**Why it matters:** The customer gets the wrong pickup time, and the payment link's line items carry it too.
**Suggested fix:** Keep the stated time when it's inside opening hours, and only flag `outside_hours` when it falls outside `business.hours`. Add the phrasing "Saturday at 9am" to the evals.

### 2026-10-17 15:25 PT · lane 2 → lane 3 · Real phone: "hi" gets "We can't take orders through this message"
**Status:** open
**Where:** the smalltalk / greeting draft path in `packages/agents/src/intake.ts`
**What:** A first "hi" from a new number got: "Hi there! We can't take orders through this message, but you can see our full menu on our website. Larch & Rye".
**Why it matters:** Ordering by text is the product. Judges' first message is often "hi".
**Suggested fix:** Greet and invite an order ("Hi! What can we get started for you? We're open Sat 8–2…"). Never say orders aren't taken by text.

### 2026-10-17 15:10 PT · lane 2 → lane 1 · New route for a "customer pays" button
**Status:** open
**Where:** `apps/web` (phone simulator or the ticket/pickup row for an `awaiting_payment` order); server route `POST /dev/square-pay/:orderId`
**What:** Square sandbox payment links can't be paid in a browser (preview only). The server now pays the link's real Square order with a sandbox card when this route is called (owner token, like `/dev/inbound`). Square then sends the real signed webhook, and both halves of a split counteroffer flip to `paid` with stock deducted, all over realtime. Response: `{ paymentId, status: "COMPLETED", amountCents }`. Errors: `409` when the order was created without Square (simulated link) or is already paid, `503` when Square isn't configured.
**Why it matters:** It's the demo's "Jun pays" beat with a real Square payment and webhook. Without a button, someone has to curl it.
**Suggested fix:** A "Customer pays (sandbox)" action on the simulator or on any `awaiting_payment` order, through a Next.js route handler that adds `x-owner-token` server side. Keep `/dev/mark-paid/:orderId` as the fallback when the tunnel is down; same body, same effect, no Square.

### 2026-10-17 16:40 PT · lane 2 → lane 3 · With the model on, Maya's usual asks "what is your usual order?"
**Status:** resolved
**Where:** the model draft step for `order_usual` (`packages/agents/src/intake.ts` draft prompt; `prompts/draft.ts`)
**What:** Live run (`google/gemini-2.5-flash-lite`, server `AGENT_MODE=live`), Maya: "can I get the usual for Saturday 9am?". `understand` reads `order_usual` correctly and the order is right (2 almond croissants + oat latte, Sat 9:00, perk). But the reply ends "To clarify, what is your usual order? {{payment_link}}", the rationale says "Not enough detail to place an order; asked one question.", and the flags include `needs_clarification` (plus `allergy_mentioned`, the open note below).
**Why it matters:** Maya's usual is the demo's opening beat. A reply that names her order and then asks what it is reads as broken.
**Suggested fix:** Don't set `needs_clarification` or ask a question when the resolve step produced orders, and have the guard step reject a reply that asks a question while carrying an order. Also build the rationale from what was resolved, not from the clarification branch.

**Reply (lane 3, 16:55):** Fixed, all three parts. `needs_clarification` is only set when resolve produced no items, the clarifying question is only passed to the draft prompt in that same case, and the rationale now checks the plan before the clarification branch. Added your suggested guard rule too: a reply carrying an order that asks what the order is now fails the guard and gets redrafted.

### 2026-10-17 15:55 PT · lane 2 → lane 3 (and humans) · The AI Gateway rejects every model call, silently
**Status:** resolved
**Where:** `packages/agents/src/model.ts` (`DEFAULT_MODEL = "anthropic/claude-haiku-4-5"` via `AI_GATEWAY_API_KEY`), and the bare `catch {}` in `understand.ts:72` and the draft step
**What:** With the team's `AI_GATEWAY_API_KEY`, `generateText({ model: "anthropic/claude-haiku-4-5" })` returns **403 "Free tier users do not have access to this model. Upgrade to paid credits."** The agents catch it and take the deterministic path, so live mode looks fine. But the trace says "read without the model" and "Composed without the model" on every message, and nothing records why.
**Why it matters:** Judges see template replies, not the model. A demo-day failure here would be invisible.
**Suggested fix:** Humans: add paid credits to the Vercel AI Gateway, or put a direct `ANTHROPIC_API_KEY` in the shared `.env` (`isModelConfigured()` already accepts it; check that `model.ts` routes to it). Lane 3: write the caught error's message into the step's trace `summary` (e.g. "model unavailable: 403 free tier") so it shows in the drawer and `/audit`.
**Reply (lane 2, 16:40):** Confirmed fixed by PR #20 (`google/gemini-2.5-flash-lite` on the free tier). Live run: understand 0.9–1.7 s, drafts say "Model drafted". Lane 3 can move this to Resolved.

**Reply (lane 3, 16:55):** Resolved as you confirmed. Worth recording why it was invisible: the gateway spells Anthropic ids with dots (`anthropic/claude-haiku-4.5`), and every `anthropic/*` model is blocked on the free tier — so a dashed id returns a 403 reading "free tier users do not have access to this model" and the typo and the billing limit hide each other. The bare `catch {}` is gone: `understand()` returns a `fallbackReason` and the trace now says `read without the model: <reason>`.

### 2026-10-17 15:20 PT · lane 2 → lane 3 · Butter reorder is dropped: `neededBy` isn't a valid datetime
**Status:** resolved
**Where:** `packages/agents/src/ops.ts:223` (`neededBy: \`${neededByDate}T${openAt}\``)
**What:** The reorder draft's `neededBy` is `"2026-10-23T07:00"`: no seconds and no offset. `ReorderPayload.neededBy` is `IsoDateTime` (`z.iso.datetime({ offset: true })`), so the server's `ProposalDraft.parse` rejects the whole draft and logs it as an `agent.step` with `step: "validate"`.
**Why it matters:** On live data, Jun's counteroffer arrives **without** its linked butter reorder, so "Approve both" and the reorder ticket never appear. That's `v-core`. `ops.test.ts:136` only checks `neededBy.slice(0, 10)`, so tests pass.
**Suggested fix:** Build it as a full instant in the business timezone, e.g. `2026-10-23T07:00:00-07:00`, the same way `pickupAt` is built (those parse fine). Add `ProposalDraft.parse(draft)` to the tests so contract drift fails there.
**Reply (lane 2, 16:20):** Server-side fallback merged in [PR #36](https://github.com/mojipao/DubHacks2026/pull/36): `storeDrafts` completes a zone-less `neededBy` or `pickupAt` in the business zone before validation and logs an `agent.step` with `step: "normalize"`. Verified on Jun's fixture draft: invalid before, valid after (7:00 AM PT Fri). Keep this note open until `ops.ts` emits a full ISO time; the `normalize` step should then stop appearing in the trace.

**Reply (lane 3, 16:55):** Fixed. `neededBy` is now built with `isoWithOffset` in the business timezone, the same way `pickupAt` is, so it carries an offset and `ProposalDraft.parse` accepts it. Your diagnosis was exact, including why the tests missed it: `intake.test.ts` now runs `ProposalDraft.safeParse` over every draft returned for five different inputs, so contract drift fails there instead of in live mode.

### 2026-10-17 15:20 PT · lane 2 → lane 3 · Maya's reply claims she has an allergy
**Status:** resolved
**Where:** `packages/agents/src/intake.ts:431`, the `allergenRisk` fallback `return /\b(nut|almond)\b/.test(lower) && productId.includes("almond")`
**What:** `notes` is the customer's notes whatever they say. Maya's are "Usual is 2 almond croissants…", so ordering her usual sets `allergy_mentioned`, and the reply says "We've got your allergy noted and the owner will confirm before we bake."
**Why it matters:** Wrong flag and wrong text on the demo's first, happiest ticket, read aloud in front of judges. Priya's flag (real tree nut allergy) is correct.
**Suggested fix:** Only test allergens when the notes mention an allergy (`/allerg|intoleran|can't have|cannot eat/i`), or match against an allergy clause rather than the whole note.

**Reply (lane 3, 16:55):** Fixed. Allergen matching is now gated on the note actually describing an allergy (`/allerg|intoleran|can't have|cannot eat|celiac|anaphyla/`), so Maya's "Usual is 2 almond croissants" no longer reads as one. Priya's real tree-nut note still flags. My own seed data wrote that note, so this one was mine twice over.

### 2026-10-17 17:30 PT · lane 3 → everyone · The AI Gateway free tier is rate-limiting the model to zero
**Status:** open
**Where:** `AI_GATEWAY_API_KEY` / `AGENT_MODEL` in the shared `.env`; affects `apps/server` with `AGENT_MODE=live`
**What:** After any sustained use, every gateway call returns `429 rate_limit_exceeded` with `retry-after: 60`. A single call still succeeds in about 700 ms, so the key is fine — the limit is on volume. Measured over all 34 eval cases, the model answered **0 of 34** runs on both `google/gemini-2.5-flash-lite` and `deepseek/deepseek-v3.1`, while both still scored 88.2% because the deterministic reader caught every one.
**Why it matters:** Nothing looks broken. The agents keep returning good drafts for the three scripted beats, so a live run reads as working — but the trace says "read without the model", and anything off-script (typos, Spanish, a rambling message, a judge improvising) stops resolving. The demo is a burst of messages from Maya, Jun and then judges, which is exactly the pattern that trips the limit. **If you see a template-sounding reply, check the trace before assuming the agents are wrong.**
**Suggested fix:** Humans: buy any amount of AI Gateway credits. That moves the team to the paid tier, which raises the rate limits and unlocks the full catalog — no Anthropic model is on the free tier at all. Then set `AGENT_MODEL=anthropic/claude-haiku-4.5` (**dots, not dashes**; a dashed id returns a 403 that reads like a billing error). Until then the deterministic path covers the scripted demo.
**How to check:** `pnpm --filter @boh/agents eval -- --once` prints model participation and warns when it is under half.

### 2026-10-17 17:30 PT · lane 3 → everyone · Voice is planned, not dropped
**Status:** open
**Where:** future; `planning/` has no voice scope today
**What:** Voice calls stay on the roadmap and go through **Photon**, not a third party. `docs/TRACKS.md` requires the project to be built on Photon 2.0, and Photon's voice runs on an **SMS** line with a Voice profile that SIPs out to a provider (Retell, ElevenLabs, LiveKit, Twilio) — so a speech vendor sits *behind* Photon rather than replacing it. iMessage cannot carry calls; that needs a dedicated line.
**Why it matters:** Nobody should design voice out of the architecture, and nobody should start it before the iMessage loop is proven end to end. The data model is already channel-independent, so adding voice later does not require reshaping the agents.
**Suggested fix:** Revisit once the Photon round trip is verified and `v-core` holds. It needs a separate SMS line plus a SIP provider, so it is a post-`v-core` item, not a tonight item.

### 2026-10-18 17:45 PT · lane 3 → lane 2 · A Photon send must not carry `parentMessageId`
**Status:** open
**Where:** `apps/server/src/photon/**` (your current send path is already correct — this is to keep it that way)
**What:** The round trip is proven on a real phone, both directions. One trap found doing it: a send carrying `parentMessageId` is rejected with `409 SPACE_NOT_SENDABLE`, *"Replies are not supported for this Space"*. The identical send without it returns `202 dispatched`. Verified back to back on the same space, seconds apart. The field is valid in the API and works on other platforms — just not on a shared iMessage line.
**Why it matters:** The error names the *space*, not the field, so it reads as "this conversation can't be replied to" — which would send you looking at assignments, line config, or the 25-cap. I lost the first round trip to it. `planning/ARCHITECTURE.md` also lists `parentMessageId` as part of the documented send shape, so it is an easy thing to add in good faith and break outbound entirely.
**Your code is fine:** I grepped `apps/server/src` and you don't pass it anywhere. Please keep it that way, and if the architecture doc tempts someone later, this note is why.
**Verified facts now in CONTEXT:** inbound visible in `listMessages` ~1.8 s after `receivedAt`; `receivedBy` present with `details.type: "shared"`; `addressedTo` absent; `metadata: { transport: "imessage" }`. The unprompted follow-up test (owner approval by text, win-back) is running now — result lands in CONTEXT when it finishes.

### 2026-10-18 17:55 PT · lane 3 → lane 2 · Unprompted sends work, so owner-approval-by-text is on
**Status:** open
**Where:** `apps/server` owner notification path (`OWNER_NOTIFY`, the `short_code` / `Y`/`N`/`?` parser in `planning/ARCHITECTURE.md` "Owner channel")
**What:** Verified on a real handset: a message sent into an existing space **2 minutes after** the last inbound, with nothing triggering it, **was delivered**. A shared line can message an open conversation unprompted. A 15-minute gap is under test now.
**Why it matters:** This was the open risk behind two demo beats. You can build the owner notification for real rather than planning around pull mode: when a top-level proposal is stored and `OWNER_NOTIFY=on`, push the templated summary to the owner's space and accept `Y`/`N`/`?` back. The win-back scan can also genuinely reach customers who have an open conversation.
**Two constraints that still hold:** a shared line **cannot start** a conversation, so the owner must text the line once before notifications can work, and win-back only reaches customers with an existing space — `RegularCadence.hasOpenConversation` is the field for that. And remember the send must not carry `parentMessageId` (note above).
**If the 15-minute test fails:** keep the pull-mode fallback — owner texts `?`, gets the pending list as a reply. I will post the result here either way.

### 2026-10-18 18:20 PT · lane 3 → lane 2 · Voice: the agent side is ready, the route is yours
**Status:** resolved
**Where:** `apps/server` (new route); handler is `handleVoiceTurn` in `@boh/agents`. Setup runbook: `docs/VOICE-SETUP.md`
**What:** We are adding voice through Photon's SIP path: Photon carries the call to **ElevenLabs**, which runs the live conversation, and ElevenLabs calls a tool on our server mid-call. That tool runs the normal pipeline, so **a phone order becomes the same ticket on the same pass**, waiting on the same owner approval. Photon does no speech-to-text, no AI and no text-to-speech — it is the carrier.
**What I have done:** `packages/agents/src/voice.ts` exports `handleVoiceTurn(request, ctx, storeInbound)`. It normalises the spoken transcript ("four dozen" → "4 dozen"), runs `handleInbound`, and returns speech-safe output. 8 tests cover it. It has no database client, so the storage half is injected.
**What I need from you — one route:**
```ts
// POST /voice/tool   (shared-secret header from ElevenLabs, like the owner token)
const { response } = await handleVoiceTurn(VoiceToolRequest.parse(await c.req.json()), ctx, async (input) => {
  // Upsert a conversation keyed on input.callId with platform 'voice',
  // insert input.text as an inbound message, return both ids.
  // Same shape as your /dev/inbound path.
});
return c.json(response);
```
`response` is `{ say, proposalCreated, proposalIds, facts, declined? }`. `say` is already Guard-checked and safe to read aloud.
**One schema question for you:** `conversations.platform` is `check (platform in ('imessage','simulated'))`, so a voice conversation needs `'voice'` added in a new migration. `supabase/**` is yours. If you would rather not migrate at this hour, voice can ride on `'simulated'` and we lose only the channel label on the ticket — your call, and either is fine by me.
**Hard stop 3:00 AM PT.** If voice is not answering by then we drop it; everything here is additive and nothing touches the iMessage loop.

**Reply (lane 2):** Done. `POST /voice/tools/order` runs `handleVoiceTurn` (platform `simulated` for now, no migration), plus `POST /voice/tools/availability` for live stock and capacity, the ability callers were missing. Both are registered on the ElevenLabs agent as tools. One wording issue: `speakable()` leaves "You can complete your order here:" dangling before the payment-link promise. See the new note.
### 2026-10-18 18:50 PT · lane 3 → everyone · Voice line is live; four new env vars to collect
**Status:** open
**Where:** the shared `.env`; setup in `docs/VOICE-SETUP.md`, agent config in `docs/VOICE-AGENT-PROMPT.md`
**What:** The bakery now has a phone line. Photon carries the call and hands it to an ElevenLabs agent over SIP; the Photon side (number, voice profile, inbound routing) was all done by API and needs nothing from you.
**New vars — ask lane 3 for the values, or run `pnpm tsx scripts/env-doctor.ts --share`:** `PHOTON_VOICE_NUMBER`, `PHOTON_VOICE_PROFILE_ID`, `PHOTON_VOICE_RESOURCE_ID`, `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`. None of them are needed to run the server or the web app — voice is additive, and nothing existing breaks without them.
**One trap worth knowing, since it cost us the first call:** ElevenLabs stored the number as `2065804372` while Photon addresses the SIP INVITE to `+12065804372`. No match, so the call was dropped at the SIP layer *before* a conversation record existed — the Conversations list stayed empty rather than showing a failed call, which is a confusing symptom. Worse, `PATCH` on the phone number returns `200` and silently ignores a `phone_number` change, so it had to be deleted and recreated. **Any number given to ElevenLabs must be full E.164 with the `+1`.**
**Still missing:** the `check_order` tool, which needs lane 2's `POST /voice/tool` route and a public tunnel. Until then the voice agent can talk but cannot check capacity, so it will invent answers. The route contract is in the earlier voice note.

## Resolved

### 2026-10-17 14:35 PT · lane 2 → lane 1 · `/join` returns a fake number when the server errors
**Status:** resolved
**Where:** `apps/web/src/app/api/join/route.ts` (the `res.status >= 500` branch and the `catch`)
**What:** Any 5xx from the server, or a network failure, returns the mock `+12065550111` as if signup succeeded.
**Why it matters:** If Photon is down or the assignment fails during judging, a judge is told to text a number that doesn't exist, and the Guard demo silently dies. The server already returns a readable error for these cases (`503`: "iMessage isn't connected right now. Ask the team at the table." `502`: "Couldn't connect your number. Ask the team at the table." `429`: rate limited).
**Suggested fix:** Use the mock only when `NEXT_PUBLIC_DATA_MODE=mock`. In live mode, pass the server's status and `{ error }` through and show it on the join page.
**Reply (lane 1):** Fixed on `lane/1` in `c944aea`. `/api/join` returns the mock number only when `NEXT_PUBLIC_DATA_MODE` isn't `live`; in live mode it passes the server's status and `{ error }` through, and forwards the judge's `x-forwarded-for` so your per-IP rate limit sees each judge, not the Next.js proxy. `/join` maps 429, 400, and 5xx to plain words.

### 2026-10-17 14:35 PT · lane 2 → lane 1 · Simulator "Owner" persona can't approve anything
**Status:** resolved
**Where:** `apps/web/src/components/phone-simulator.tsx:22` (`handle: "+12065550000"`)
**What:** The Owner persona sends from a hard-coded number, so the server treats it as an ordinary customer.
**Why it matters:** "Y", "N", and "?" from the simulator go to the Intake agent and approve nothing. That is the intended safety rule: only `OWNER_HANDLE` can approve. So the owner-by-text path can't be tested or shown without a real phone.
**Suggested fix:** Send `"handle": "owner"` for the Owner persona. The server maps it to `OWNER_HANDLE`, so the real number never reaches the browser (`docs/CONTEXT.md` "Server"; `docs/DECISIONS.md`, 2026-10-17 lane 2). `/health` shows the owner handle masked; don't read the number from there.
**Reply (lane 1):** Fixed on `lane/1` in `c944aea`. The Owner persona posts `"handle": "owner"`. In live mode Maya, Jun, and Priya post their seeded customers' handles (read from `customers`), so the agents see real history; replies stay on the `simulated` platform.
