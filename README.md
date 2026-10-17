# DubHacks 2026

Shared repo for a three-person team. Humans and coding agents use the same files so a decision made in one session is visible in the others.

Sponsored side tracks (source of truth for prizes and eligibility): [’26 Sponsored Side Tracks](https://dubhacks.notion.site/26-Sponsored-Side-Tracks-5e3ff32c1d7e834d9844812256c9fa06). A local digest lives in [`docs/TRACKS.md`](docs/TRACKS.md), captured 2026-10-17. If organizers change that page, update the digest and log it in [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Current project

No track or product is chosen yet. That state is recorded in [`docs/CONTEXT.md`](docs/CONTEXT.md). Do not start application code until a human sets the track and the one-sentence product there.

## Read this order

Every person, and every agent at the start of a session:

1. [`AGENTS.md`](AGENTS.md) — how to work without colliding
2. [`docs/CONTEXT.md`](docs/CONTEXT.md) — what we are building
3. [`docs/STATUS.md`](docs/STATUS.md) — who owns which lane and files
4. [`docs/DECISIONS.md`](docs/DECISIONS.md) — choices that are already made
5. [`docs/TRACKS.md`](docs/TRACKS.md) — prize constraints, only when choosing or checking eligibility

## Three lanes

| Lane | Branch | Who |
| --- | --- | --- |
| 1 | `lane/1` | First teammate to claim it in `docs/STATUS.md` |
| 2 | `lane/2` | Second |
| 3 | `lane/3` | Third |

One person, one clone, one lane. Two agents must not share a working tree.

Shared facts (context, status, decisions) land on `main` in small commits. Feature work stays on that person’s lane branch until it is ready to merge.

## Session start

```bash
git fetch origin
git checkout main
git pull --rebase origin main
```

Then read the files above before editing anything. Claim a task in `docs/STATUS.md`, push that claim, and only then write code. Full steps are in [`docs/COORDINATION.md`](docs/COORDINATION.md).
