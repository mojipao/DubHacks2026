# Agent instructions

You are one of up to three coding agents on this repo, each run by a different person. Other agents cannot see your chat. They only see what you commit and push.

## Before you edit

1. `git fetch origin` and `git pull --rebase origin main`.
2. Read, in order: `docs/CONTEXT.md`, `docs/STATUS.md`, `docs/DECISIONS.md`, then `planning/README.md`, `planning/ARCHITECTURE.md`, and your lane's file in `planning/`.
3. If `docs/CONTEXT.md` says the track is **undecided**, do not scaffold an app, add dependencies, or pick a stack. You may edit coordination docs only after the human chooses a track and product sentence.
4. Claim work before coding. See `docs/COORDINATION.md`.

If those files disagree with the chat, the files win. Ask the human to change the file rather than inventing a new direction in the chat.

## While you work

- Stay inside your lane branch (`lane/1`, `lane/2`, or `lane/3`) for product code.
- Touch only files listed on your active claim in `docs/STATUS.md`, plus the context files you are explicitly updating.
- Put shared facts on `main` as soon as they exist: track, product sentence, stack, API keys location (names only), schema, and anything another agent would otherwise redo.
- Append decisions to `docs/DECISIONS.md`. Do not rewrite another person’s entries.
- Secrets go in `.env`, never in git. Document the variable name in `docs/CONTEXT.md`.

## When you stop

Update your row in `docs/STATUS.md` (done, blocked, or released). Push. Leave the next agent a note in the claim summary: what works, what is unfinished, which command runs it.

## Do not

- Force-push `main` or another person’s lane branch.
- Reset, rebase onto, or edit commits you did not create.
- Delete lanes, claims, or decision rows because they look idle.
- Start a second product “so we have options.” One product lives in `docs/CONTEXT.md`.
