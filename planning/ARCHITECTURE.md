# Architecture

Everything here is a contract. Lane 2 implements the schema and the shared package exactly as written. Lanes 1 and 3 code against it from minute one, before lane 2 has finished.

## System

```mermaid
flowchart LR
  subgraph Channels
    Phone[Customer iPhone] <-->|iMessage| Photon[Photon 2.0 beta API]
    Judge[Judge phone] -->|/join| Web
  end

  subgraph DataPlane[Data plane: one model of the business]
    DB[(Supabase Postgres + Realtime)]
  end

  subgraph ControlPlane[Control plane: propose, approve, execute, log]
    Server[apps/server<br/>Hono on Node 24]
    Agents[packages/agents<br/>Intake, Ops, Guard]
  end

  Web[apps/web<br/>Next.js control room] -->|approve / reject / dev inbound| Server
  DB -->|realtime reads| Web
  Photon -->|Socket.IO deliveries| Server
  Server -->|sendMessage, assignments| Photon
  Server <-->|read via AgentDataPort| Agents
  Server -->|writes only| DB
  Server -->|payment links| Square[Square sandbox]
  Square -->|webhook payment.updated| Server
  Agents -->|LLM calls| LLM[AI SDK model]
```

### Rules the architecture enforces

1. **Agents never write and never send.** `packages/agents` receives a read-only `AgentDataPort` and returns `ProposalDraft[]`. It has no Supabase client, no Photon client, no Square client.
2. **Only the approve endpoint executes.** `POST /proposals/:id/approve` is the only code path that sends a customer message, creates a payment link, or records a reorder.
3. **The server prices orders.** Agents propose product IDs and quantities. The server computes every price from the `products` table. An LLM never produces a dollar amount that reaches Square.
4. **The browser reads, never writes, the database.** Row level security allows `select` only. All writes go through the server with the owner token.
5. **Evidence is computed, not generated.** Evidence chips come from deterministic lookups in the agents package, so the "why" shown on a ticket is always true.
6. **Everything leaves a trace.** Every inbound message, agent step, proposal, decision, execution, payment, and failure is a row in `events`.

These rules are also the story we tell VEYZL and the judges: human oversight, no unpriced LLM output in payments, full audit trail.

## Repo layout

```
.
├── package.json              # lane 2: workspace root scripts
├── pnpm-workspace.yaml       # lane 2
├── tsconfig.base.json        # lane 2
├── .env.example              # lane 2: names only
├── apps/
│   ├── web/                  # lane 1: Next.js control room + /join + /audit
│   └── server/               # lane 2: Hono API, Photon listener, Square, executor
├── packages/
│   ├── shared/               # lane 2 creates; contract; additive edits by anyone
│   └── agents/               # lane 3: agent pipeline, evals, fixture data port
├── supabase/
│   └── migrations/           # lane 2
├── data/
│   ├── seed/                 # lane 3: synthetic bakery JSON
│   └── evals/                # lane 3: eval cases
├── scripts/
│   ├── seed.ts               # lane 2: loads data/seed into Supabase + Square
│   ├── reset.ts              # lane 2: wipes demo state, reseeds
│   ├── generate-history.ts   # lane 3: writes data/seed/orders.json
│   └── photon-ping.ts        # lane 3: first-hour Photon round-trip test
├── docs/                     # shared context (main only)
└── planning/                 # this plan (main only)
```

Package names: `@boh/web`, `@boh/server`, `@boh/shared`, `@boh/agents`.

## Stack

| Concern | Choice | Notes |
| --- | --- | --- |
| Runtime | Node.js 24+ | Photon's TypeScript client requires Node 24 or later |
| Package manager | pnpm workspaces | `corepack enable` |
| Language | TypeScript, ESM everywhere | `"type": "module"` |
| Validation | zod v4 | Shared schemas in `packages/shared` |
| Database | Supabase Postgres + Realtime | One shared project for the team |
| Server | Hono + `@hono/node-server`, run with `tsx` | Long-running process (holds the Photon socket) |
| Messaging | Photon 2.0 beta: `@photon-ai/api` + `socket.io-client` | Beta docs only: [photon.codes/docs/beta](https://photon.codes/docs/beta/index) |
| Payments | Square sandbox, `square` Node SDK | Payment links + `payment.updated` webhook |
| Agents | Vercel AI SDK (`ai`) | Model ID in `AGENT_MODEL`; recorded in `docs/DECISIONS.md` |
| Frontend | Next.js App Router, Tailwind, shadcn/ui, `@supabase/supabase-js` | `transpilePackages: ["@boh/shared"]` |
| Tunnel | ngrok with a free static domain | Only for Square webhooks to the demo host |
| Web hosting | Vercel (optional, M4+) | The demo can run on localhost |

Workspace packages are consumed as TypeScript source (`"exports": { ".": "./src/index.ts" }`). The server runs them through `tsx`. Next.js compiles them through `transpilePackages`.

### Photon 2.0 beta facts that shape the design

Verified against the beta docs on 2026-10-17. Re-check if something fails.

- API origin `https://api.photon.codes`, bearer auth with a project API key (`pho_sk_...`). Project IDs start with `pho_prj_`. Do not use `spectrum-ts` or the stable docs; that is a different product.
- A **shared iMessage line only receives messages from senders assigned to it.** Each sender handle (E.164 phone or iMessage email) needs an assignment, and the assigned agent number can differ per sender. The Free plan allows 25 shared assignments per project.
- A shared line **cannot send the first message.** The customer must text first. Proactive outreach (win-back blasts) is impossible on the demo line, which is why win-back is an in-conversation perk, not a campaign.
- Shared assignments support **direct conversations only**, not group chats, and no voice.
- Inbound arrives over a **Socket.IO event stream** with a replay cursor (`seq`), or by polling `listMessages`. No public webhook URL is needed for Photon.
- Outbound: `photon.projects.sendMessage` with the incoming message's `space.id` as `spaceId`, the receiving agent's `receivedBy.id` as `senderId`, an optional `parentMessageId`, and a stable `idempotency-key`.
- Assigning a sender from code: `photon.projects.platforms.imessage.assignments.create` with `body: { handle }` and an idempotency key. It needs the `platforms:write` permission and returns `assignedPhoneNumber`.
- Sends are accepted asynchronously. "Accepted" is not "delivered."

## Database schema

Lane 2 saves this as `supabase/migrations/0001_init.sql` and applies it. Do not edit it after it lands; add `0002_*.sql` and later files instead.

```sql
create extension if not exists pgcrypto;

create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  handle text unique,
  square_customer_id text unique,
  notes text,
  is_demo_persona boolean not null default false,
  created_at timestamptz not null default now()
);

create table products (
  id text primary key,
  name text not null,
  category text not null check (category in ('pastry','bread','drink','cake','savory')),
  price_cents integer not null check (price_cents >= 0),
  daily_capacity integer not null check (daily_capacity >= 0),
  active boolean not null default true
);

create table ingredients (
  id text primary key,
  name text not null,
  unit text not null,
  on_hand numeric not null,
  on_order numeric not null default 0,
  reorder_point numeric not null,
  supplier text not null,
  unit_cost_cents integer not null
);

create table recipe_lines (
  product_id text not null references products(id) on delete cascade,
  ingredient_id text not null references ingredients(id),
  qty_per_unit numeric not null check (qty_per_unit > 0),
  primary key (product_id, ingredient_id)
);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  handle text not null,
  platform text not null default 'imessage' check (platform in ('imessage','simulated')),
  photon_space_id text unique,
  photon_agent_user_id text,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  direction text not null check (direction in ('inbound','outbound')),
  body text not null,
  photon_message_id text unique,
  status text not null check (status in ('received','queued','sent','failed')),
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on messages (conversation_id, created_at);

create table proposals (
  id uuid primary key default gen_random_uuid(),
  agent text not null check (agent in ('intake','ops','winback')),
  kind text not null check (kind in ('reply','reorder')),
  status text not null default 'pending'
    check (status in ('pending','executing','executed','rejected','superseded','failed')),
  conversation_id uuid references conversations(id),
  trigger_message_id uuid references messages(id),
  parent_proposal_id uuid references proposals(id),
  title text not null,
  summary text not null,
  payload jsonb not null,
  evidence jsonb not null default '[]',
  confidence numeric check (confidence between 0 and 1),
  risk_flags text[] not null default '{}',
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  executed_at timestamptz,
  error text
);
create index proposals_status_idx on proposals (status, created_at desc);

create table orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  source text not null check (source in ('history','agent')),
  status text not null check (status in ('awaiting_payment','paid','fulfilled','cancelled')),
  pickup_at timestamptz not null,
  total_cents integer not null,
  discount_cents integer not null default 0,
  square_order_id text unique,
  square_payment_link_id text,
  payment_url text,
  proposal_id uuid references proposals(id),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index orders_customer_idx on orders (customer_id, created_at desc);
create index orders_pickup_idx on orders (pickup_at);

create table order_items (
  order_id uuid not null references orders(id) on delete cascade,
  product_id text not null references products(id),
  qty integer not null check (qty > 0),
  unit_price_cents integer not null,
  primary key (order_id, product_id)
);

create table events (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor text not null,
  type text not null,
  subject_type text,
  subject_id text,
  data jsonb not null default '{}'
);
create index events_subject_idx on events (subject_type, subject_id);

create table photon_cursor (
  id integer primary key default 1 check (id = 1),
  seq bigint not null default 0
);
insert into photon_cursor (id, seq) values (1, 0);

alter publication supabase_realtime
  add table conversations, messages, proposals, orders, ingredients, events;

do $$
declare t text;
begin
  foreach t in array array[
    'customers','products','ingredients','recipe_lines','conversations',
    'messages','proposals','orders','order_items','events'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "browser read" on %I for select to anon, authenticated using (true)', t);
  end loop;
end $$;

alter table photon_cursor enable row level security;
```

The browser can read every table, including synthetic customer names and handles. That is acceptable for a demo with synthetic data, and it is a likely VEYZL finding worth fixing if time allows (for example by masking handles in a view).

### Event vocabulary

`actor` is one of `customer`, `owner`, `system`, `photon`, `square`, `agent:intake`, `agent:ops`, `agent:guard`.

| `type` | Written by | Subject |
| --- | --- | --- |
| `message.received` | server | message |
| `message.sent` / `message.failed` | server | message |
| `agent.step` | server, from `ctx.trace` | the trigger message; `data.step`, `data.ms`, `data.detail` |
| `proposal.created` | server | proposal |
| `proposal.approved` / `proposal.rejected` / `proposal.superseded` | server | proposal; `data.edited` when text changed |
| `proposal.executed` / `proposal.failed` | server | proposal |
| `order.created` / `order.paid` | server | order |
| `payment_link.created` | server | order |
| `inventory.deducted` / `inventory.reordered` | server | ingredient |
| `customer.joined` | server | customer |
| `demo.reset` | reset script | none |

## Shared contracts

Lane 2 creates `packages/shared/src/index.ts` with exactly this content (split into files if preferred, but keep these exported names).

```ts
import { z } from "zod";

export const ProductId = z.string().min(1);
export const IsoDateTime = z.iso.datetime({ offset: true });

export const AgentName = z.enum(["intake", "ops", "winback"]);
export const ProposalKind = z.enum(["reply", "reorder"]);
export const ProposalStatus = z.enum([
  "pending", "executing", "executed", "rejected", "superseded", "failed",
]);

export const RiskFlag = z.enum([
  "new_customer",
  "low_confidence",
  "large_order",
  "capacity_shortfall",
  "ingredient_shortfall",
  "outside_hours",
  "short_notice",
  "allergy_mentioned",
  "injection_suspected",
  "needs_clarification",
  "complaint",
]);

export const Evidence = z.object({
  label: z.string(),
  value: z.string(),
  source: z.object({ table: z.string(), id: z.string() }).optional(),
});

export const OrderLine = z.object({ productId: ProductId, qty: z.number().int().positive() });

export const OrderDraft = z.object({
  items: z.array(OrderLine).min(1),
  pickupAt: IsoDateTime,
  perk: z.enum(["welcome_back_10"]).optional(),
});

export const ReplyPayload = z.object({
  text: z.string().min(1).max(1200),
  order: OrderDraft.optional(),
});

export const ReorderPayload = z.object({
  supplier: z.string(),
  lines: z.array(z.object({ ingredientId: z.string(), qty: z.number().positive() })).min(1),
  neededBy: IsoDateTime.optional(),
});

const DraftBase = z.object({
  agent: AgentName,
  title: z.string().max(80),
  summary: z.string().max(280),
  evidence: z.array(Evidence),
  confidence: z.number().min(0).max(1),
  riskFlags: z.array(RiskFlag),
  /** Index of another draft in the same returned array that this one depends on. */
  parentIndex: z.number().int().nonnegative().optional(),
});

export const ProposalDraft = z.discriminatedUnion("kind", [
  DraftBase.extend({ kind: z.literal("reply"), payload: ReplyPayload }),
  DraftBase.extend({ kind: z.literal("reorder"), payload: ReorderPayload }),
]);

export type Evidence = z.infer<typeof Evidence>;
export type RiskFlag = z.infer<typeof RiskFlag>;
export type OrderLine = z.infer<typeof OrderLine>;
export type OrderDraft = z.infer<typeof OrderDraft>;
export type ReplyPayload = z.infer<typeof ReplyPayload>;
export type ReorderPayload = z.infer<typeof ReorderPayload>;
export type ProposalDraft = z.infer<typeof ProposalDraft>;
export type ProposalStatus = z.infer<typeof ProposalStatus>;

/** The placeholder the server replaces with the Square payment link URL at execution time. */
export const PAYMENT_LINK_TOKEN = "{{payment_link}}";

export interface BusinessProfile {
  name: string;
  timezone: string;                 // "America/Los_Angeles"
  hours: Record<"mon"|"tue"|"wed"|"thu"|"fri"|"sat"|"sun", { open: string; close: string } | null>;
  minLeadHours: number;             // ordinary pre-orders
  cateringThresholdUnits: number;   // at or above this many units, treat as catering
  cateringLeadHours: number;
  largeOrderCents: number;          // flag above this total
  welcomeBackAfterDays: number;     // perk eligibility
  voice: string;                    // one paragraph describing how the shop texts
  poweredByFooter: string;          // appended by the server to every customer reply
}

export interface CustomerProfile {
  id: string;
  name: string;
  handle: string | null;
  notes: string | null;
  isDemoPersona: boolean;
}

export interface OrderSummary {
  id: string;
  createdAt: string;
  pickupAt: string;
  status: "awaiting_payment" | "paid" | "fulfilled" | "cancelled";
  totalCents: number;
  items: { productId: string; name: string; qty: number }[];
}

export interface Product {
  id: string;
  name: string;
  category: "pastry" | "bread" | "drink" | "cake" | "savory";
  priceCents: number;
  dailyCapacity: number;
  active: boolean;
}

export interface DayLoad {
  productId: string;
  committed: number;   // units in awaiting_payment + paid orders for that local date
  capacity: number;
}

export interface IngredientNeed {
  ingredientId: string;
  name: string;
  unit: string;
  need: number;        // for the requested items plus everything already committed that day
  onHand: number;
  onOrder: number;
  shortfall: number;   // max(0, need - onHand - onOrder)
  supplier: string;
}

export interface ConversationContext {
  id: string;
  handle: string;
  customerId: string | null;
  messages: { id: string; direction: "inbound" | "outbound"; body: string; createdAt: string }[];
}

/** Read-only access the server gives to agents. Lane 2 implements it on Supabase; lane 3 implements it on fixtures. */
export interface AgentDataPort {
  getConversation(conversationId: string, limit?: number): Promise<ConversationContext>;
  getCustomer(customerId: string): Promise<CustomerProfile | null>;
  getCustomerByHandle(handle: string): Promise<CustomerProfile | null>;
  getOrderHistory(customerId: string, limit?: number): Promise<OrderSummary[]>;
  getCatalog(): Promise<Product[]>;
  getDayLoad(localDate: string): Promise<DayLoad[]>;   // "YYYY-MM-DD" in business timezone
  getIngredientNeeds(items: OrderLine[], localDate: string): Promise<IngredientNeed[]>;
  getPendingProposals(conversationId: string): Promise<{ id: string; kind: "reply" | "reorder"; summary: string }[]>;
}

export interface AgentContext {
  data: AgentDataPort;
  business: BusinessProfile;
  now: () => Date;
  /** The server writes each call as an `agent.step` event, which the UI shows as the ticket's trace. */
  trace: (step: string, detail: Record<string, unknown>) => void;
}

export interface InboundInput { conversationId: string; messageId: string }

/** Implemented by packages/agents. */
export type HandleInbound = (input: InboundInput, ctx: AgentContext) => Promise<ProposalDraft[]>;
```

`packages/agents` exports `handleInbound: HandleInbound`. Until lane 3 merges, lane 2 uses a stub that returns one canned reply draft.

## Server HTTP API

Base URL `SERVER_URL` (default `http://localhost:8787`). JSON in and out. Errors are `{ "error": string }` with a 4xx or 5xx status.

Owner routes require the header `x-owner-token: $OWNER_TOKEN`. The browser never sees this token. The Next.js app calls these routes from its own server-side route handlers.

| Method and path | Auth | Body | Result |
| --- | --- | --- | --- |
| `GET /health` | none | | `{ ok, photonInbound, squareMode, agentMode }` |
| `POST /proposals/:id/approve` | owner | `{ editedText?: string }` | `{ proposal }` after execution, or `409` if not pending |
| `POST /proposals/:id/reject` | owner | `{ reason?: string }` | `{ proposal }` |
| `POST /join` | none, rate-limited | `{ name: string, handle: string }` | `{ agentNumber: string, customerId: string }` |
| `POST /dev/inbound` | owner | `{ handle: string, name?: string, text: string }` | `{ conversationId, messageId }`; uses platform `simulated` |
| `POST /dev/ops-scan` | owner | `{}` | `{ created: number }` (stretch) |
| `POST /webhooks/square` | Square signature | raw Square event | `200` quickly |

### Approve and execute

```mermaid
stateDiagram-v2
  [*] --> pending: agent draft stored
  pending --> superseded: newer inbound in same conversation
  pending --> rejected: owner rejects
  pending --> executing: owner approves (atomic, only if pending)
  executing --> executed: all side effects succeeded
  executing --> failed: any side effect failed (error stored)
```

For a `reply` proposal the server, in order:

1. Moves `pending` → `executing` with `update ... where status = 'pending' returning *`. If no row comes back, return `409`.
2. If `editedText` is present, validate it the same way as `ReplyPayload.text` and use it.
3. If `payload.order` exists: price each line from `products`, apply the perk only if the customer is eligible under `BusinessProfile.welcomeBackAfterDays`, insert `orders` (status `awaiting_payment`, source `agent`) and `order_items`, then create a Square payment link with idempotency key `proposal:<id>` and store `square_order_id`, `square_payment_link_id`, `payment_url`.
4. Replace `{{payment_link}}` in the text with the URL. If the token is missing and a link exists, append the URL on a new line. Append `BusinessProfile.poweredByFooter`.
5. Send: platform `imessage` goes through `photon.projects.sendMessage` with idempotency key `proposal:<id>`. Platform `simulated` skips Photon.
6. Insert the outbound `messages` row, mark the proposal `executed`, and write events for each step.
7. On any failure: mark `failed` with `error`, write `proposal.failed`, return `502` with the error.

For a `reorder` proposal: add each line's quantity to `ingredients.on_order`, write `inventory.reordered`, mark `executed`. Supplier delivery is simulated and says so in the UI.

### Inbound handling

1. Receive (Photon delivery, or `POST /dev/inbound`). Ignore anything that is not an inbound human message on the configured platform, and anything the agent itself sent.
2. Upsert `conversations` by `photon_space_id` (or by handle for simulated). Link `customer_id` by handle.
3. Insert `messages` with `photon_message_id` (unique, so redeliveries are no-ops). Write `message.received`.
4. Mark any `pending` reply proposals in this conversation `superseded`.
5. Debounce 4 seconds per conversation so a burst of texts becomes one agent run, then call `handleInbound`.
6. Validate every returned draft with `ProposalDraft.parse`. Insert valid ones (resolving `parentIndex` to `parent_proposal_id`). Log invalid ones as `agent.step` with `detail.error`.
7. Persist the Photon `seq` cursor only after the message row is committed.

### Square webhook

Verify the `x-square-hmacsha256-signature` header against the raw body and the exact notification URL using the Square SDK's webhook helper. On `payment.updated` with status `COMPLETED`: find the order by `square_order_id`, mark it `paid` with `paid_at` (idempotent), subtract recipe ingredient amounts from `ingredients.on_hand`, write `order.paid` and `inventory.deducted`.

## Environment variables

One `.env` at the repo root, shared privately. `apps/web/.env.local` holds the web subset. Names only here; never commit values.

| Name | Used by | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | server, scripts | |
| `SUPABASE_SERVICE_ROLE_KEY` | server, scripts | Server only, never in the browser |
| `NEXT_PUBLIC_SUPABASE_URL` | web | Same value as `SUPABASE_URL` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web | The anon or publishable key |
| `PHOTON_PROJECT_ID` | server, ping script | Starts with `pho_prj_` |
| `PHOTON_API_KEY` | server, ping script | Project key with `project:read`, `project:write`, `platforms:read`, `platforms:write` |
| `PHOTON_INBOUND` | server | `on` only on the demo host; `off` everywhere else |
| `PHOTON_TEST_SENDER` | ping script | A teammate's iMessage phone, E.164 |
| `SQUARE_ACCESS_TOKEN` | server, scripts | Sandbox token |
| `SQUARE_LOCATION_ID` | server, scripts | Sandbox location |
| `SQUARE_ENVIRONMENT` | server, scripts | `sandbox` |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | server | From the sandbox webhook subscription |
| `SQUARE_WEBHOOK_URL` | server | Exact URL registered with Square, needed for signature checks |
| `AI_GATEWAY_API_KEY` | agents (in server process), evals | Or a direct provider key; record the choice in `docs/DECISIONS.md` |
| `AGENT_MODEL` | agents | Model ID string |
| `AGENT_MODE` | server | `live` or `stub` (canned drafts, no LLM) |
| `OWNER_TOKEN` | server, web server side | Random 32+ characters |
| `SERVER_URL` | web server side | `http://localhost:8787` or the tunnel URL |
| `NEXT_PUBLIC_DATA_MODE` | web | `live` or `mock` |
| `DEMO_PERSONAS` | seed script | `maya=+12065550100,jun=+12065550101,priya=+12065550102` with real teammate numbers |
| `PORT` | server | Default `8787` |

## Run modes

| Mode | Who | What runs |
| --- | --- | --- |
| Mock UI | lane 1 alone | `pnpm --filter @boh/web dev` with `NEXT_PUBLIC_DATA_MODE=mock`; no server, no database |
| Stub server | lane 2 alone | Server with `AGENT_MODE=stub`, `PHOTON_INBOUND=off`; drive it with `POST /dev/inbound` |
| Fixture agents | lane 3 alone | `pnpm --filter @boh/agents eval` and `pnpm --filter @boh/agents chat` against fixture data |
| Integrated dev | anyone | Server with `AGENT_MODE=live`, `PHOTON_INBOUND=off`, web with `NEXT_PUBLIC_DATA_MODE=live`, simulated inbound from the web phone simulator |
| Demo host | one machine | Everything live: `PHOTON_INBOUND=on`, Square webhook pointed at this machine's ngrok domain |

Root scripts lane 2 provides:

```bash
pnpm install
pnpm dev            # server + web in parallel
pnpm typecheck      # all packages
pnpm seed           # load data/seed into Supabase and Square sandbox
pnpm reset          # wipe agent-created state, reseed (announce first)
```
