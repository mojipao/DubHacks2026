# Status

Claim board for three lanes. Edit your own row only, except to mark a claim `blocked` when the owner is gone and the human asked you to take it.

Status values: `idle`, `active`, `blocked`.

| Lane | GitHub user | Branch | Status | Task | Files | Handoff |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | aahil1218 | `lane/1` | active | Frontend: Setup + Phase 1 mock control room | `apps/web/**`, `planning/LANE-1-FRONTEND.md` | Claimed. Scaffolding `@boh/web`, "the pass" design system, mock data source, TicketFace + Inbox + Today + ticker. Vercel GitHub integration connected (Root Directory `apps/web` once app exists). Run TBD after Phase 1: `pnpm --filter @boh/web dev`. |
| 2 | mojipao | `lane/2` | active | Backend: live wiring (seed, Photon, Square) | `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json`, `.env.example`, `.gitignore`, `.github/**`, `apps/server/**`, `packages/shared/**`, `supabase/**`, `scripts/seed.ts`, `scripts/reset.ts`, `scripts/tsconfig.json` | Phases 2 to 7 merged ([PR #4](https://github.com/mojipao/DubHacks2026/pull/4), [PR #6](https://github.com/mojipao/DubHacks2026/pull/6)); every route works now on simulated Photon and Square. See "Server" in `docs/CONTEXT.md`. **Waiting on:** lane 3's `data/seed` on `main` (then lane 2 runs `pnpm reset --yes`); `PHOTON_API_KEY`, `PHOTON_PROJECT_ID`, `OWNER_HANDLE` in the shared `.env` (lane 3 has them); Square sandbox keys and webhook (lane 2 human, steps 2 to 4). Run: `pnpm install && pnpm --filter @boh/server dev`. |
| 3 | ybassyiouni | `lane/3` | active | Agents: Phase 3 evals | `packages/agents/**`, `data/**`, `scripts/generate-history.ts`, `scripts/photon-ping.ts`, `scripts/check-seed.ts`, `submission/**` | **Phase 2 merged ([PR #12](https://github.com/mojipao/DubHacks2026/pull/12)): `handleInbound` is ready, so lane 2 can set `AGENT_MODE=live`.** `import { handleInbound, runWinbackScan } from "@boh/agents"`. 21 tests pass with no network: Maya's usual with the perk, Jun's 4 dozen splitting 24 Sat + 24 Sun behind one link with a linked 3 kg butter reorder, and a judge's injection declined with no order. Both model steps have deterministic fallbacks, so it works today with **no LLM key set** — same path as `AGENT_MODE=stub`. `AGENT_MODEL` will be `anthropic/claude-haiku-4-5` via `AI_GATEWAY_API_KEY` once a key exists. Run: `pnpm --filter @boh/agents test`, `pnpm --filter @boh/agents chat -- --as jun`. Lane 2 still needs `getDayLoad`, `getIngredientNeeds` (populate the new optional `reorderPoint`/`unitCostCents`), and `getNextOpenDays` on `SupabaseDataPort`; `createFixtureWorld` is exported to test against. Phase 0 ping script is written but **not yet run live**. Next: `data/evals` + `eval.ts`. |

## How to read this

An `active` row owns those files until the status changes. Overlapping file lists are a conflict; do not start.

`main` itself is not a lane. Context edits (`docs/CONTEXT.md`, `docs/DECISIONS.md`, this file) are short commits on `main` and do not need a file claim beyond the commit that updates them.
