# DubHacks 2026

Shared repo for a three-person team. Humans and coding agents use the same files so a decision made in one session is visible in the others.

Sponsored side tracks (source of truth for prizes and eligibility): [’26 Sponsored Side Tracks](https://dubhacks.notion.site/26-Sponsored-Side-Tracks-5e3ff32c1d7e834d9844812256c9fa06). A local digest lives in [`docs/TRACKS.md`](docs/TRACKS.md), captured 2026-10-17. If organizers change that page, update the digest and log it in [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Current project

**Back of House**: customers text a small coffee shop (Kettle & Crow Coffee) on iMessage, agents draft replies, Square payment links, and supplier reorders from the shop's data, and the owner approves each one in a live control room. Title track Cook Smarter; sponsored tracks Photon, VEYZL, and SideShift.

### How a customer texts the shop: scan a QR code (a workaround)

Customers scan a QR code at the counter (`/join/qr`), enter their name and iPhone number on `/join`, and tap **Open iMessage**. Messages opens addressed to the shop with a first message already typed. From then on they text that number like any contact.

This is a **workaround for the hackathon**, not the intended product. We run on Photon's free plan, which uses **shared iMessage lines**:

- A shared line only accepts texts from phone numbers registered to it, so every customer has to sign up once through `/join` first. Texts from unregistered numbers are silently dropped.
- Each customer may get a **different** shop number (in testing, two phones got two different lines).
- The free plan caps registrations at 25 phones.

The real fix is a **dedicated iMessage line on Photon's Business plan: $250 per line per month**. Every customer could text one public number with no sign-up and no QR code, and no server changes are needed. We left it out only because of cost.

The build plan is in [`planning/`](planning/README.md): shared architecture and contracts, one file per lane, and the demo and submission plan. The current facts are in [`docs/CONTEXT.md`](docs/CONTEXT.md).

## Read this order

Every person, and every agent at the start of a session:

1. [`AGENTS.md`](AGENTS.md) — how to work without colliding
2. [`docs/CONTEXT.md`](docs/CONTEXT.md) — what we are building
3. [`docs/STATUS.md`](docs/STATUS.md) — who owns which lane and files
4. [`docs/DECISIONS.md`](docs/DECISIONS.md) — choices that are already made
5. [`docs/NOTES.md`](docs/NOTES.md) — open notes between lanes; check the ones addressed to you
6. [`planning/README.md`](planning/README.md), [`planning/ARCHITECTURE.md`](planning/ARCHITECTURE.md), then your lane file
7. [`docs/TRACKS.md`](docs/TRACKS.md) — prize constraints, only when checking eligibility

## Three lanes

| Lane | Branch | Who |
| --- | --- | --- |
| 1 | `lane/1` | Frontend, aahil1218. Plan: [`planning/LANE-1-FRONTEND.md`](planning/LANE-1-FRONTEND.md) |
| 2 | `lane/2` | Backend, mojipao. Plan: [`planning/LANE-2-BACKEND.md`](planning/LANE-2-BACKEND.md) |
| 3 | `lane/3` | Agents, unclaimed. Plan: [`planning/LANE-3-AGENTS.md`](planning/LANE-3-AGENTS.md) |

One person, one clone, one lane. Two agents must not share a working tree.

Shared facts (context, status, decisions) land on `main` in small commits. Feature work stays on that person’s lane branch until it is ready to merge.

## Session start

```bash
git fetch origin
git checkout main
git pull --rebase origin main
```

Then read the files above before editing anything. Claim a task in `docs/STATUS.md`, push that claim, and only then write code. Full steps are in [`docs/COORDINATION.md`](docs/COORDINATION.md).
