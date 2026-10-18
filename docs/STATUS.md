# Status

Claim board for three lanes. Edit your own row only, except to mark a claim `blocked` when the owner is gone and the human asked you to take it.

Status values: `idle`, `active`, `blocked`.

| Lane | GitHub user | Branch | Status | Task | Files | Handoff |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | aahil1218 | `lane/1` | active | Frontend: Phase 2–4 live wiring, simulator, join | `apps/web/**`, `planning/LANE-1-FRONTEND.md` | Live data source rewritten and the simulator is ready as every lane's test harness: open `/` and press `S` (or `?sim=1`). Persona Owner sends `"owner"`; Maya/Jun/Priya use their seeded handles. Mock mode (`NEXT_PUBLIC_DATA_MODE=mock`) plays every demo scenario with the server's event shapes, including owner Y/N/?. `/join` passes real server errors through in live mode. `/audit` computes "sent without approval" from events. Run: `pnpm install && pnpm --filter @boh/web dev`. **Waiting on:** the shared `.env` (`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `OWNER_TOKEN`) on this machine to verify live mode end to end; lane 1 PR into `main`. |
| 2 | mojipao | `lane/2` | active | Backend: coffee-shop switch, demo host | `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json`, `.env.example`, `.gitignore`, `.github/**`, `apps/server/**`, `packages/shared/**`, `supabase/**`, `scripts/seed.ts`, `scripts/reset.ts`, `scripts/demo-host.ts`, `scripts/tsconfig.json` | **Shared DB reset announced:** lane 2 runs `pnpm reset --yes` right after the Kettle & Crow PR merges (wipes tickets, messages, conversations, events, agent orders; reseeds the coffee menu). Verified live earlier: iMessage in/out, owner by text, Square sandbox link + webhook. Demo host: `pnpm demo:host` (server, ngrok, caffeinate, one checklist). Run: `pnpm install && pnpm --filter @boh/server dev`. |
| 3 | ybassyiouni | `lane/3` | active | Agents: evals done, submission next | `packages/agents/**`, `data/**`, `scripts/generate-history.ts`, `scripts/photon-ping.ts`, `scripts/check-seed.ts`, `scripts/env-doctor.ts`, `submission/**` | Phases 1-3 merged. `handleInbound` + `runWinbackScan` live; 34 eval cases at **88.2%** (`pnpm --filter @boh/agents eval`), 31 unit tests, `pnpm tsx scripts/check-seed.ts` guards the demo arithmetic. **Read the NOTES entry on the AI Gateway rate limit before you judge a reply** — the model is currently answering 0 of 34 runs and everything silently falls back to the deterministic reader. Fixed since the last update: the dropped butter reorder ([#37](https://github.com/mojipao/DubHacks2026/pull/37)), Maya's false allergy flag, and the reply that asked what the order was. Still open: the Photon outbound round trip (needs a human to text), and `submission/**`. |

## How to read this

An `active` row owns those files until the status changes. Overlapping file lists are a conflict; do not start.

`main` itself is not a lane, and it is protected: context edits (`docs/CONTEXT.md`, `docs/DECISIONS.md`, `docs/NOTES.md`, this file) land through a short `ctx/lane-N-<topic>` PR with auto-merge (see `docs/COORDINATION.md`). They do not need a file claim beyond that PR.
