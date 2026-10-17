# Agent instructions

You are one of up to three coding agents on this repo, each run by a different person. Other agents cannot see your chat. They only see what you commit and push.

## Before you edit

1. `git fetch origin`, then read from `origin/main`. `main` is protected: every change, docs included, lands through a PR that passes CI. See `docs/COORDINATION.md`.
2. Read, in order: `docs/CONTEXT.md`, `docs/STATUS.md`, `docs/DECISIONS.md`, the open notes in `docs/NOTES.md`, then `planning/README.md`, `planning/ARCHITECTURE.md`, and your lane's file in `planning/`.
3. If `docs/CONTEXT.md` says the track is **undecided**, do not scaffold an app, add dependencies, or pick a stack. You may edit coordination docs only after the human chooses a track and product sentence.
4. Claim work before coding. See `docs/COORDINATION.md`.

If those files disagree with the chat, the files win. Ask the human to change the file rather than inventing a new direction in the chat.

## While you work

- Stay inside your lane branch (`lane/1`, `lane/2`, or `lane/3`) for product code.
- Touch only files listed on your active claim in `docs/STATUS.md`, plus the context files you are explicitly updating.
- Put shared facts on `main` as soon as they exist, through a docs-only `ctx/...` PR: track, product sentence, stack, API keys location (names only), schema, and anything another agent would otherwise redo.
- Append decisions to `docs/DECISIONS.md`. Do not rewrite another person’s entries.
- Secrets go in `.env`, never in git. Document the variable name in `docs/CONTEXT.md`.

## Notes between lanes

When you find something another lane must act on (a mismatch with your API, a bug in their files, a surprise from a third-party API), add it to `docs/NOTES.md` instead of fixing their files. Check the open notes addressed to your lane at session start and before each PR; reply under the note, and move it to "Resolved" once it's fixed.

## When you stop

Update your row in `docs/STATUS.md` (done, blocked, or released) and land it with a `ctx/...` PR. Leave the next agent a note in the claim summary: what works, what is unfinished, which command runs it.

## Do not

- Force-push `main` or another person’s lane branch.
- Reset, rebase onto, or edit commits you did not create.
- Delete lanes, claims, or decision rows because they look idle.
- Start a second product “so we have options.” One product lives in `docs/CONTEXT.md`.
