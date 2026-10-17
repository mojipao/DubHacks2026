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

### 2026-10-17 15:55 PT · lane 2 → lane 3 (and humans) · The AI Gateway rejects every model call, silently
**Status:** open
**Where:** `packages/agents/src/model.ts` (`DEFAULT_MODEL = "anthropic/claude-haiku-4-5"` via `AI_GATEWAY_API_KEY`), and the bare `catch {}` in `understand.ts:72` and the draft step
**What:** With the team's `AI_GATEWAY_API_KEY`, `generateText({ model: "anthropic/claude-haiku-4-5" })` returns **403 "Free tier users do not have access to this model. Upgrade to paid credits."** The agents catch it and take the deterministic path, so live mode looks fine. But the trace says "read without the model" and "Composed without the model" on every message, and nothing records why.
**Why it matters:** Judges see template replies, not the model. A demo-day failure here would be invisible.
**Suggested fix:** Humans: add paid credits to the Vercel AI Gateway, or put a direct `ANTHROPIC_API_KEY` in the shared `.env` (`isModelConfigured()` already accepts it; check that `model.ts` routes to it). Lane 3: write the caught error's message into the step's trace `summary` (e.g. "model unavailable: 403 free tier") so it shows in the drawer and `/audit`.

### 2026-10-17 15:20 PT · lane 2 → lane 3 · Butter reorder is dropped: `neededBy` isn't a valid datetime
**Status:** open
**Where:** `packages/agents/src/ops.ts:223` (`neededBy: \`${neededByDate}T${openAt}\``)
**What:** The reorder draft's `neededBy` is `"2026-10-23T07:00"`: no seconds and no offset. `ReorderPayload.neededBy` is `IsoDateTime` (`z.iso.datetime({ offset: true })`), so the server's `ProposalDraft.parse` rejects the whole draft and logs it as an `agent.step` with `step: "validate"`.
**Why it matters:** On live data, Jun's counteroffer arrives **without** its linked butter reorder, so "Approve both" and the reorder ticket never appear. That's `v-core`. `ops.test.ts:136` only checks `neededBy.slice(0, 10)`, so tests pass.
**Suggested fix:** Build it as a full instant in the business timezone, e.g. `2026-10-23T07:00:00-07:00`, the same way `pickupAt` is built (those parse fine). Add `ProposalDraft.parse(draft)` to the tests so contract drift fails there.

### 2026-10-17 15:20 PT · lane 2 → lane 3 · Maya's reply claims she has an allergy
**Status:** open
**Where:** `packages/agents/src/intake.ts:431`, the `allergenRisk` fallback `return /\b(nut|almond)\b/.test(lower) && productId.includes("almond")`
**What:** `notes` is the customer's notes whatever they say. Maya's are "Usual is 2 almond croissants…", so ordering her usual sets `allergy_mentioned`, and the reply says "We've got your allergy noted and the owner will confirm before we bake."
**Why it matters:** Wrong flag and wrong text on the demo's first, happiest ticket, read aloud in front of judges. Priya's flag (real tree nut allergy) is correct.
**Suggested fix:** Only test allergens when the notes mention an allergy (`/allerg|intoleran|can't have|cannot eat/i`), or match against an allergy clause rather than the whole note.

### 2026-10-17 14:35 PT · lane 2 → lane 1 · `/join` returns a fake number when the server errors
**Status:** open
**Where:** `apps/web/src/app/api/join/route.ts` (the `res.status >= 500` branch and the `catch`)
**What:** Any 5xx from the server, or a network failure, returns the mock `+12065550111` as if signup succeeded.
**Why it matters:** If Photon is down or the assignment fails during judging, a judge is told to text a number that doesn't exist, and the Guard demo silently dies. The server already returns a readable error for these cases (`503`: "iMessage isn't connected right now. Ask the team at the table." `502`: "Couldn't connect your number. Ask the team at the table." `429`: rate limited).
**Suggested fix:** Use the mock only when `NEXT_PUBLIC_DATA_MODE=mock`. In live mode, pass the server's status and `{ error }` through and show it on the join page.

### 2026-10-17 14:35 PT · lane 2 → lane 1 · Simulator "Owner" persona can't approve anything
**Status:** open
**Where:** `apps/web/src/components/phone-simulator.tsx:22` (`handle: "+12065550000"`)
**What:** The Owner persona sends from a hard-coded number, so the server treats it as an ordinary customer.
**Why it matters:** "Y", "N", and "?" from the simulator go to the Intake agent and approve nothing. That is the intended safety rule: only `OWNER_HANDLE` can approve. So the owner-by-text path can't be tested or shown without a real phone.
**Suggested fix:** Send `"handle": "owner"` for the Owner persona. The server maps it to `OWNER_HANDLE`, so the real number never reaches the browser (`docs/CONTEXT.md` "Server"; `docs/DECISIONS.md`, 2026-10-17 lane 2). `/health` shows the owner handle masked; don't read the number from there.

## Resolved

None yet.
