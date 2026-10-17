# Decisions

Append-only. Newest row at the top. Do not edit someone else’s row; add a new row if a decision changes.

| Date | Lane | Decision | Why |
| --- | --- | --- | --- |
| 2026-10-17 | 1 | Lanes integrate through PRs with merge commits, and lanes merge `origin/main` instead of rebasing once pushed. | Squash merges and rebased lanes cause repeated conflicts with three parallel branches; PRs also give VEYZL something to audit. |
| 2026-10-17 | 1 | History orders are synthetic rows in our database; Square handles customers, payment links, and payment webhooks only. | Square cannot backdate orders, and the demo needs months of history. |
| 2026-10-17 | 1 | Use Photon 2.0 beta (`@photon-ai/api`, Socket.IO events) rather than stable `spectrum-ts`. A `/join` page assigns judge numbers before they text. | The sponsor track requires 2.0 beta. Shared lines only receive from assigned senders and cannot send first. |
| 2026-10-17 | 1 | Agents return drafts through a read-only data port; only the server's approve endpoint sends, charges, or reorders, and the server sets every price. | Human oversight and auditability are the product's trust story and the VEYZL story. |
| 2026-10-17 | 1 | Lane roles: 1 frontend (mojipao), 2 backend, 3 agents. Ownership in `planning/README.md`. | Separates folders so three agents rarely touch the same files. |
| 2026-10-17 | 1 | Product: Back of House for a synthetic bakery (Larch & Rye). Title track Cook Smarter; sponsored tracks Photon, VEYZL, SideShift. Stack in `planning/ARCHITECTURE.md`. | Strongest fit for the 30% track-applicability score, and all three sponsored tracks reinforce the same demo. |
| 2026-10-17 | — | Shared context lives in `docs/`, and product work waits until `docs/CONTEXT.md` names a track and a product. | Three agents were about to start from an empty repo with no common brief. |
