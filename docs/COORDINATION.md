# Coordination

Three people, three agents, one `main`. Chat history is not shared. Git is.

## Branches

- `main` holds the latest shared context and integrated code.
- `lane/1`, `lane/2`, and `lane/3` are the only feature branches. One GitHub user per lane, recorded in `docs/STATUS.md`.

Create your lane once, from an up-to-date `main`:

```bash
git checkout main
git pull --rebase origin main
git checkout -b lane/1   # or lane/2, lane/3
git push -u origin HEAD
```

## Claim before you code

1. Pull `main`.
2. Read `docs/STATUS.md`. If your files overlap a claim whose status is `active`, pick different files or wait.
3. On `main`, fill your lane row: task, files you will touch, status `active`, and a one-line summary.
4. Commit only `docs/STATUS.md` with message `claim: lane/N short-task-name` and push.
5. If the push is rejected, `git pull --rebase origin main`, re-read `STATUS.md`, and claim again only if the overlap is gone.
6. Check out your lane, merge `origin/main` into it, then edit the claimed files.

Release the claim the same way when you stop: set status to `idle` or `blocked`, say what the next agent needs, commit, push.

## What goes where

| Change | Branch | When |
| --- | --- | --- |
| Track, product, stack, schema, env var names | `main` (`docs/CONTEXT.md`, `docs/DECISIONS.md`) | Immediately, before more feature work |
| Claim and handoff | `main` (`docs/STATUS.md`) | Before starting and before stopping |
| Product code | Your `lane/N` | After the claim is on `origin/main` |
| Finished slice | PR from `lane/N` into `main` | When it runs and does not rewrite other lanes |

## Conflicts

Bring `main` into your lane with `git fetch origin && git merge origin/main`. Do not rebase a lane branch that is already pushed. Merge lane PRs into `main` with a merge commit, not a squash. If a context file conflicts, keep both decision bullets and both claim notes, then leave the lane row accurate.

Do not force-push. A rejected push means someone else wrote context you have not read yet.
