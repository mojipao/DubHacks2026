# Status

Claim board for three lanes. Edit your own row only, except to mark a claim `blocked` when the owner is gone and the human asked you to take it.

Status values: `idle`, `active`, `blocked`.

| Lane | GitHub user | Branch | Status | Task | Files | Handoff |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | aahil1218 | `lane/1` | active | Frontend: Setup + Phase 1 mock control room | `apps/web/**`, `planning/LANE-1-FRONTEND.md` | Claimed. Scaffolding `@boh/web`, "the pass" design system, mock data source, TicketFace + Inbox + Today + ticker. Vercel GitHub integration connected (Root Directory `apps/web` once app exists). Run TBD after Phase 1: `pnpm --filter @boh/web dev`. |
| 2 | mojipao | `lane/2` | active | Backend: scaffold, CI, contracts, database | `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json`, `.env.example`, `.gitignore`, `.github/**`, `apps/server/**`, `packages/shared/**`, `supabase/**`, `scripts/seed.ts`, `scripts/reset.ts` | Phase 0 merged ([PR #1](https://github.com/mojipao/DubHacks2026/pull/1)): workspace, `@boh/shared`, server `/health`, CI. `main` now requires the `build` check; see `docs/COORDINATION.md`. Phase 1 done: schema applied to Supabase `jxluhvblusfzrlktqaee`, `Database` types in `@boh/shared`, server `db()` and `logEvent`. Next: Phase 2 stub loop (`/dev/inbound`, approve/reject). Run: `pnpm install && pnpm --filter @boh/server dev`. |
| 3 | ybassyiouni | `lane/3` | active | Agents: Phase 0 Photon ping | `packages/agents/**`, `data/**`, `scripts/generate-history.ts`, `scripts/photon-ping.ts`, `scripts/check-seed.ts`, `submission/**` | Claimed by Yousuf (`ybassyiouni`). Photon project and API key exist; `PHOTON_PROJECT_ID`, `PHOTON_API_KEY`, `PHOTON_AGENT_HANDLE`, `OWNER_HANDLE` are in lane 3's private `.env`. Next on `lane/3`: `scripts/photon-ping.ts`, text `ping` to the shop line, run the unprompted follow-up test, then record the redacted field names under "Photon facts verified" in `docs/CONTEXT.md`. Square and LLM keys still missing. No overlap with lane 1 or 2. |

## How to read this

An `active` row owns those files until the status changes. Overlapping file lists are a conflict; do not start.

`main` itself is not a lane. Context edits (`docs/CONTEXT.md`, `docs/DECISIONS.md`, this file) are short commits on `main` and do not need a file claim beyond the commit that updates them.
