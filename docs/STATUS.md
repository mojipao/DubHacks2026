# Status

Claim board for three lanes. Edit your own row only, except to mark a claim `blocked` when the owner is gone and the human asked you to take it.

Status values: `idle`, `active`, `blocked`.

| Lane | GitHub user | Branch | Status | Task | Files | Handoff |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | mojipao | `lane/1` | idle | Frontend | — | Plan ready: `planning/LANE-1-FRONTEND.md`. Start at Setup. |
| 2 | unassigned | `lane/2` | idle | Backend | — | Claim this lane, then start `planning/LANE-2-BACKEND.md` Phase 0. Everyone waits on the scaffold. |
| 3 | unassigned | `lane/3` | idle | Agents | — | Claim this lane, then start `planning/LANE-3-AGENTS.md` Phase 0 (Photon ping). |

## How to read this

An `active` row owns those files until the status changes. Overlapping file lists are a conflict; do not start.

`main` itself is not a lane. Context edits (`docs/CONTEXT.md`, `docs/DECISIONS.md`, this file) are short commits on `main` and do not need a file claim beyond the commit that updates them.
