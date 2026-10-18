# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary user of this surface: **hackathon judges** watching a short live demo of Back of House, plus the teammate operating the control room during that demo.

Durable user the product is built for: the **owner of a small food business** (demo shop: **Yemeni Coffee**). They are mid-service, clearing agent-drafted work before anything reaches a customer or supplier. Customers text the shop; they do not use this web UI as their primary surface.

## Product Purpose

**Back of House** is an operations agent for small food businesses. Customers text the shop on iMessage (Photon). Agents read customers, orders, capacity, and stock, then propose replies, Square payment links, and supplier reorders — including counteroffers when a request cannot be met as asked. Nothing goes out until the owner approves in this control room or by iMessage (`Y` / `N` / `?`).

**Success for this web surface (locked):** judges understand, in a short demo, the counteroffer + agent trace + human gate — that agents draft with evidence, and the owner is the pass.

## Positioning

Not an auto-reply ordering bot. The product mechanism a neighbor could not truthfully copy as "chatbot takes orders":

1. Agents can **say no** and propose a capacity/inventory-aware counteroffer linked to the restock that makes it possible.
2. Every ticket shows **what was read and why** (trace).
3. **Human approval** is required before any customer or supplier message leaves — control room or phone.
4. Deterministic **Guard** flags (e.g. injection) are visible on the pass, not hidden failures.

The control room uses the kitchen **"pass"** metaphor: tickets hang on a rail; nothing leaves until the owner calls them out.

## Operating Context

- Hackathon: DubHacks 2026 (Cook Smarter title track; sponsored Photon, VEYZL, SideShift). Deadline Sun 2026-10-18 10:00 AM PT.
- Demo loop: real or simulated iMessage → agent drafts → tickets on the rail → Approve / Approve both → Square sandbox payment → stock and friction update live.
- Companion surfaces in this app: phone simulator (demo fallback), `/join` for judges, `/audit` for the trust log.
- Demo host runs the server with Photon inbound; web may be local or Vercel with `SERVER_URL` to the demo host.
- Synthetic data only; real phone numbers live only in private `.env`.

## Capabilities and Constraints

**In scope for the control room:** approve/reject (including linked sets), ticket drawer with trace/evidence/flags, conversations + thread, today board (pickups/stock/revenue), friction-saved strip, Guard presentation, phone simulator, join/QR, audit table.

**Constraints:**

- Owner token stays server-side; browser never sees `OWNER_TOKEN`.
- Catalog prices and business rules come from shared seed / server — UI must not invent prices.
- Product name stays **Back of House**. Demo business display name is **Yemeni Coffee** (UI). Seed may still say Kettle & Crow until data is updated — chrome uses `SHOP_NAME` in `apps/web`.
- Open product facts (not for this file to invent): who texts as Maya; multi-track entry rules with organizers.

## Brand Commitments

- **Product:** Back of House. Customer texts may carry a powered-by footer (`Sent with Back of House · backofhouse.app` in seed).
- **Demo shop:** Yemeni Coffee.
- **Visual world:** Arwa-inspired — one warm cream room (no dark/light split), editorial type, messages beside tickets on the pass; reply and restock are separate items.
- **Voice (shop outbound, from seed):** warm and brief, first name, state the real constraint plainly, at most one emoji, never all caps, sign with the shop name.
- **Pass metaphor** is intentional product language for this UI, not decoration.

## Evidence on Hand

- Seed and fixtures under `data/seed/` and `apps/web/src/mocks/` (synthetic customers, orders, demo scenarios including Maya usual, Jun 4-dozen counteroffer + butter reorder, Guard injection, allergy, win-back).
- Live integrations exist on the demo host (Photon, Square sandbox, Supabase); do not fabricate testimonials, revenue claims, or paid-customer proof.
- Friction minutes come from `BusinessProfile.minutesSaved` in seed — estimated owner minutes, not measured field study.

## Product Principles

1. **Owner is the pass** — agents draft; humans release.
2. **Show the work** — rationale, records read, and trace are first-class, not buried.
3. **Say the constraint** — counteroffers and Guard refusals are confident product moments, not soft errors.
4. **Demo-readable in seconds** — hierarchy and motion serve a short judge walkthrough under projector conditions.
5. **One shop truth** — names, prices, and capacity agree with seed and server; never invent copy that contradicts them.

## Accessibility & Inclusion

No formal WCAG target was set. Practical floor for this surface: primary approve/reject and ticket focus remain keyboard-operable (existing shortcuts); type and contrast stay readable at projector / demo-laptop distance; do not ship critical actions that depend on color alone.
