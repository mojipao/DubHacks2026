# Decisions

Append-only. Newest row at the top. Do not edit someone else’s row; add a new row if a decision changes.

| Date | Lane | Decision | Why |
| --- | --- | --- | --- |
| 2026-10-17 | 2 | CI on every PR and push to `main` (install, typecheck, build); `main` should require it to pass before merging. | Three agents merging in parallel; a broken `main` blocks everyone. |
| 2026-10-17 | 2 | The team uses a new dedicated Supabase project. Never touch project `ykvvrkvihmfvcesbnker`; it belongs to another project of mojipao's. | That project was the MCP default and is unrelated to the hackathon. |
| 2026-10-17 | 2 | mojipao moves from lane 1 to lane 2 (backend). Lane 1 is open. | Owner choice. Supersedes the lane 1 assignment in the roles row below. |
| 2026-10-17 | 1 | Seed orders use dates relative to seed time; reseed before the demo. | Static dates go stale overnight and break "41 days ago" and this weekend's capacity numbers. |
| 2026-10-17 | 1 | Owner can approve by iMessage (`Y code` / `N code` / `?`) only from `OWNER_HANDLE`; win-back scan is a post-`v-core` stretch. Both depend on unprompted sends, which Phase 0 tests. | Puts the agent where the owner already is; shared Photon lines can't start conversations. |
| 2026-10-17 | 1 | Contract changes before any code: `ReplyPayload.orders` (0 to 2, one shared payment link), drafts carry `rationale` and `reads`, new flags `counteroffer`, `off_policy`, `abusive`, `off_topic`, products get `aliases`. | Needed for the counteroffer and the ticket-face trace. |
| 2026-10-17 | 1 | `v-core` now includes the counteroffer with a linked reorder, the agent trace, deterministic Guard flags, and the friction saved counter. M3 moves to 11:00 PM. | The agent's judgment and the trace are what separate this from an ordering system; they can't be 3 AM extras. |
| 2026-10-17 | 1 | Lanes integrate through PRs with merge commits, and lanes merge `origin/main` instead of rebasing once pushed. | Squash merges and rebased lanes cause repeated conflicts with three parallel branches; PRs also give VEYZL something to audit. |
| 2026-10-17 | 1 | History orders are synthetic rows in our database; Square handles customers, payment links, and payment webhooks only. | Square cannot backdate orders, and the demo needs months of history. |
| 2026-10-17 | 1 | Use Photon 2.0 beta (`@photon-ai/api`, Socket.IO events) rather than stable `spectrum-ts`. A `/join` page assigns judge numbers before they text. | The sponsor track requires 2.0 beta. Shared lines only receive from assigned senders and cannot send first. |
| 2026-10-17 | 1 | Agents return drafts through a read-only data port; only the server's approve endpoint sends, charges, or reorders, and the server sets every price. | Human oversight and auditability are the product's trust story and the VEYZL story. |
| 2026-10-17 | 1 | Lane roles: 1 frontend (mojipao), 2 backend, 3 agents. Ownership in `planning/README.md`. | Separates folders so three agents rarely touch the same files. |
| 2026-10-17 | 1 | Product: Back of House for a synthetic bakery (Larch & Rye). Title track Cook Smarter; sponsored tracks Photon, VEYZL, SideShift. Stack in `planning/ARCHITECTURE.md`. | Strongest fit for the 30% track-applicability score, and all three sponsored tracks reinforce the same demo. |
| 2026-10-17 | — | Shared context lives in `docs/`, and product work waits until `docs/CONTEXT.md` names a track and a product. | Three agents were about to start from an empty repo with no common brief. |
