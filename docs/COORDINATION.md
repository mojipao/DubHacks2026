# Coordination

Three people, three agents, one `main`. Chat history is not shared. Git is.

Repo: [mojipao/DubHacks2026](https://github.com/mojipao/DubHacks2026). If your clone still points at `aahil1218/DubHacks2026`, run `git remote set-url origin https://github.com/mojipao/DubHacks2026.git`.

## `main` is protected

`main` only accepts changes through pull requests whose `build` check passed. Direct pushes from non-admins are rejected, and force-pushes and deletions are blocked for everyone. This applies to docs and claims too, so every change, even a one-line status update, is a small PR that auto-merges when CI is green.

## Branches

- `main`: the latest shared context and integrated code.
- `lane/1`, `lane/2`, `lane/3`: product code. One GitHub user per lane, recorded in `docs/STATUS.md`.
- `ctx/lane-N-<topic>`: short-lived branches for docs-only changes (claims, handoffs, context, decisions). Create from `origin/main`, merge, delete.

Create your lane once, from an up-to-date `main`:

```bash
git fetch origin
git checkout -b lane/1 origin/main   # or lane/2, lane/3
git push -u origin HEAD
```

## Context and claim changes (docs only)

Use this for `docs/STATUS.md`, `docs/CONTEXT.md`, `docs/DECISIONS.md`, and `planning/**`:

```bash
git fetch origin
git checkout -b ctx/lane-N-<topic> origin/main
# edit only docs files
git commit -am "claim: lane/N short-task-name"     # or a plain description
git push -u origin HEAD
gh pr create --base main --title "ctx: lane/N <topic>" --body "<one line>"
gh pr merge --auto --merge --delete-branch
```

Auto-merge lands it as soon as `build` passes, usually within a minute. Then return to your lane: `git checkout lane/N && git fetch origin && git merge origin/main`.

## Claim before you code

1. `git fetch origin` and read `origin/main:docs/STATUS.md`. If your files overlap a claim whose status is `active`, pick different files or wait.
2. Fill your lane row (task, files, status `active`, one-line summary) and land it with the docs-only flow above.
3. If the PR has a merge conflict in `docs/STATUS.md`, someone claimed at the same time. Close it, re-read `STATUS.md`, and claim again only if the overlap is gone.
4. Once the claim is on `main`, merge `origin/main` into your lane and edit the claimed files.

Release the claim the same way when you stop: set status to `idle` or `blocked`, say what the next agent needs, and land it with the docs-only flow.

## What goes where

| Change | Branch | When |
| --- | --- | --- |
| Track, product, stack, schema, env var names | `ctx/...` PR → `main` | Immediately, before more feature work |
| Claim and handoff | `ctx/...` PR → `main` | Before starting and before stopping |
| Product code | Your `lane/N` | After the claim is on `main` |
| Finished slice | PR from `lane/N` into `main` | When it runs and does not rewrite other lanes |

## CI and merging

`.github/workflows/ci.yml` runs on every PR and every push to `main`: `pnpm install --frozen-lockfile`, typecheck, lint, test, and build (each where a package defines it), then boots the server and checks `/health`. The check is named `build`, and `main` requires it.

Lane PRs:

```bash
git fetch origin && git merge origin/main      # bring main in first
pnpm install && pnpm -r typecheck              # commit pnpm-lock.yaml if it changed
git push
gh pr create --base main --head lane/N --title "..." --body "..."
gh pr merge --auto --merge                     # merge commit, not squash; waits for build
```

If CI fails, fix it on your lane and push again; auto-merge resumes. Do not disable the workflow, remove the required check, or ask an admin to bypass it.

## Conflicts

Bring `main` into your lane with `git fetch origin && git merge origin/main`. Do not rebase a lane branch that is already pushed. If a context file conflicts, keep both decision rows and both claim notes, then leave the lane row accurate.

Do not force-push. A rejected push or a conflicted PR means someone else wrote context you have not read yet.
