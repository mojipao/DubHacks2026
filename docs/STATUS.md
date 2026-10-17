# Status

Claim board for three lanes. Edit your own row only, except to mark a claim `blocked` when the owner is gone and the human asked you to take it.

Status values: `idle`, `active`, `blocked`.

| Lane | GitHub user | Branch | Status | Task | Files | Handoff |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | aahil1218 | `lane/1` | active | Frontend: Phase 1 mock UI merging to main | `apps/web/**`, `planning/LANE-1-FRONTEND.md` | Phase 1 mock control room on `lane/1`. Run: `pnpm install && pnpm --filter @boh/web dev`. Screens: pass + simulator + `/join` + `/join/qr` + `/audit`. Live data source ready against lane 2 stub loop. Vercel Root Directory = `apps/web`. Progress: `planning/LANE-1-FRONTEND.md`. |
| 2 | mojipao | `lane/2` | active | Backend: live wiring (seed, Photon, Square) | `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json`, `.env.example`, `.gitignore`, `.github/**`, `apps/server/**`, `packages/shared/**`, `supabase/**`, `scripts/seed.ts`, `scripts/reset.ts`, `scripts/tsconfig.json` | Phases 2 to 7 merged ([PR #4](https://github.com/mojipao/DubHacks2026/pull/4), [PR #6](https://github.com/mojipao/DubHacks2026/pull/6)); every route works now on simulated Photon and Square. See "Server" in `docs/CONTEXT.md`. **Waiting on:** lane 3's `data/seed` on `main` (then lane 2 runs `pnpm reset --yes`); `PHOTON_API_KEY`, `PHOTON_PROJECT_ID`, `OWNER_HANDLE` in the shared `.env` (lane 3 has them); Square sandbox keys and webhook (lane 2 human, steps 2 to 4). Run: `pnpm install && pnpm --filter @boh/server dev`. |
| 3 | ybassyiouni | `lane/3` | active | Agents: Phase 2 `@boh/agents` | `packages/agents/**`, `data/**`, `scripts/generate-history.ts`, `scripts/photon-ping.ts`, `scripts/check-seed.ts`, `submission/**` | Phase 1 merged ([PR #7](https://github.com/mojipao/DubHacks2026/pull/7)): `data/seed/*.json` is complete, so **lane 2's seed and `business.json` fallback are unblocked**. `pnpm tsx scripts/generate-history.ts` rewrites `orders.json` deterministically; `pnpm tsx scripts/check-seed.ts` asserts the demo arithmetic and exits non-zero if it breaks. Butter croissants: Sat 12/36 committed, Sun 6/36, butter covers 30 more, so 4 dozen splits 24 + 24 with a 3 kg Rainier Dairy reorder. Seed `history` orders as `fulfilled` and `upcoming` as `paid`. Phase 0 ping script is written but **not yet run** (needs the human to text from the assigned phone). Next: `packages/agents` with `handleInbound`. Square and LLM keys still missing. |

## How to read this

An `active` row owns those files until the status changes. Overlapping file lists are a conflict; do not start.

`main` itself is not a lane. Context edits (`docs/CONTEXT.md`, `docs/DECISIONS.md`, this file) are short commits on `main` and do not need a file claim beyond the commit that updates them.
