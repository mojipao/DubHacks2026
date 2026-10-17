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
