# Status

Claim board for three lanes. Edit your own row only, except to mark a claim `blocked` when the owner is gone and the human asked you to take it.

Status values: `idle`, `active`, `blocked`.

| Lane | GitHub user | Branch | Status | Task | Files | Handoff |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | unassigned | `lane/1` | idle | — | — | Claim this lane by putting your GitHub login here, then push. |
| 2 | unassigned | `lane/2` | idle | — | — | Claim this lane by putting your GitHub login here, then push. |
| 3 | unassigned | `lane/3` | idle | — | — | Claim this lane by putting your GitHub login here, then push. |

## How to read this

An `active` row owns those files until the status changes. Overlapping file lists are a conflict; do not start.

`main` itself is not a lane. Context edits (`docs/CONTEXT.md`, `docs/DECISIONS.md`, this file) are short commits on `main` and do not need a file claim beyond the commit that updates them.
