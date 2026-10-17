# Status

Claim board for three lanes. Edit your own row only, except to mark a claim `blocked` when the owner is gone and the human asked you to take it.

Status values: `idle`, `active`, `blocked`.

| Lane | GitHub user | Branch | Status | Task | Files | Handoff |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | aahil1218 | `lane/1` | active | Frontend: Phase 1 mock UI on `lane/1` (PR pending) | `apps/web/**`, `planning/LANE-1-FRONTEND.md` | Phase 1 shipped on `lane/1` (`c9f62d7`). Run: `pnpm install && pnpm --filter @boh/web dev` (mock). Screens: control room pass + simulator + `/join` + `/join/qr` + `/audit`. Open PR from https://github.com/aahil1218/DubHacks2026/compare/main...lane/1 (needs `gh auth login`). Next: merge PR, then Phase 2 live mode once lane 2 applies Supabase migration. Vercel Root Directory = `apps/web`. Progress log in `planning/LANE-1-FRONTEND.md`. |
| 2 | mojipao | `lane/2` | active | Backend: scaffold, CI, contracts, database | `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json`, `.env.example`, `.gitignore`, `.github/**`, `apps/server/**`, `packages/shared/**`, `supabase/**`, `scripts/seed.ts`, `scripts/reset.ts` | Phase 0 merged ([PR #1](https://github.com/aahil1218/DubHacks2026/pull/1)): workspace, `@boh/shared`, server `/health`, CI. Lanes 1 and 3 can start. Next: Phase 1 database, blocked on the new Supabase project (do not use `ykvvrkvihmfvcesbnker`). Run: `pnpm install && pnpm --filter @boh/server dev`. |
| 3 | unassigned | `lane/3` | idle | Agents | — | Claim this lane, then start `planning/LANE-3-AGENTS.md` Phase 0 (Photon ping). |

## How to read this

An `active` row owns those files until the status changes. Overlapping file lists are a conflict; do not start.

`main` itself is not a lane. Context edits (`docs/CONTEXT.md`, `docs/DECISIONS.md`, this file) are short commits on `main` and do not need a file claim beyond the commit that updates them.
