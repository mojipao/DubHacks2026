# Status

Claim board for three lanes. Edit your own row only, except to mark a claim `blocked` when the owner is gone and the human asked you to take it.

Status values: `idle`, `active`, `blocked`.

| Lane | GitHub user | Branch | Status | Task | Files | Handoff |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | aahil1218 | `lane/1` | active | Frontend: Setup + Phase 1 mock control room | `apps/web/**`, `planning/LANE-1-FRONTEND.md` | Claimed. Scaffolding `@boh/web`, "the pass" design system, mock data source, TicketFace + Inbox + Today + ticker. Vercel GitHub integration connected (Root Directory `apps/web` once app exists). Run TBD after Phase 1: `pnpm --filter @boh/web dev`. |
| 2 | mojipao | `lane/2` | active | Backend: Phase 3 data port and seed | `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json`, `.env.example`, `.gitignore`, `.github/**`, `apps/server/**`, `packages/shared/**`, `supabase/**`, `scripts/seed.ts`, `scripts/reset.ts` | Phase 2 stub loop done: `POST /dev/inbound` (4 s debounce, supersedes older pending replies), `POST /proposals/:id/approve` and `/reject` (atomic, `includeLinked`), stub agent writing `agent.step` trace events. Photon and Square are simulated (`Messenger`/`Payments` in `apps/server/src/execute.ts`). Lane 1 can build live mode against it. Run: `pnpm --filter @boh/server dev`, then `curl -X POST localhost:8787/dev/inbound -H "x-owner-token: $OWNER_TOKEN" -H 'content-type: application/json' -d '{"handle":"+12065550100","name":"Maya Chen","text":"usual for saturday?"}'`. Shared DB holds a few 555-number test rows until the first `pnpm reset`. Next: `SupabaseDataPort` and seed (blocked on lane 3's `data/seed`; a default `BusinessProfile` is used until `business.json` lands). |
| 3 | ybassyiouni | `lane/3` | active | Agents: Phase 2 `@boh/agents` | `packages/agents/**`, `data/**`, `scripts/generate-history.ts`, `scripts/photon-ping.ts`, `scripts/check-seed.ts`, `submission/**` | Phase 1 merged ([PR #7](https://github.com/mojipao/DubHacks2026/pull/7)): `data/seed/*.json` is complete, so **lane 2's seed and `business.json` fallback are unblocked**. `pnpm tsx scripts/generate-history.ts` rewrites `orders.json` deterministically; `pnpm tsx scripts/check-seed.ts` asserts the demo arithmetic and exits non-zero if it breaks. Butter croissants: Sat 12/36 committed, Sun 6/36, butter covers 30 more, so 4 dozen splits 24 + 24 with a 3 kg Rainier Dairy reorder. Seed `history` orders as `fulfilled` and `upcoming` as `paid`. Phase 0 ping script is written but **not yet run** (needs the human to text from the assigned phone). Next: `packages/agents` with `handleInbound`. Square and LLM keys still missing. |

## How to read this

An `active` row owns those files until the status changes. Overlapping file lists are a conflict; do not start.

`main` itself is not a lane. Context edits (`docs/CONTEXT.md`, `docs/DECISIONS.md`, this file) are short commits on `main` and do not need a file claim beyond the commit that updates them.
