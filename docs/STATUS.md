# Status

Claim board for three lanes. Edit your own row only, except to mark a claim `blocked` when the owner is gone and the human asked you to take it.

Status values: `idle`, `active`, `blocked`.

| Lane | GitHub user | Branch | Status | Task | Files | Handoff |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | unassigned | `lane/1` | idle | Frontend | — | Released by mojipao (moved to lane 2). Claim this lane, then start `planning/LANE-1-FRONTEND.md` Setup. The empty `lane/1` branch on origin can be reused. |
| 2 | mojipao | `lane/2` | active | Backend: scaffold, CI, contracts, database | `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json`, `.env.example`, `.gitignore`, `.github/**`, `apps/server/**`, `packages/shared/**`, `supabase/**`, `scripts/seed.ts`, `scripts/reset.ts` | Phase 0 in progress. Supabase: waiting on a new dedicated project (do not use project `ykvvrkvihmfvcesbnker`). |
| 3 | unassigned | `lane/3` | idle | Agents | — | Claim this lane, then start `planning/LANE-3-AGENTS.md` Phase 0 (Photon ping). |

## How to read this

An `active` row owns those files until the status changes. Overlapping file lists are a conflict; do not start.

`main` itself is not a lane. Context edits (`docs/CONTEXT.md`, `docs/DECISIONS.md`, this file) are short commits on `main` and do not need a file claim beyond the commit that updates them.
