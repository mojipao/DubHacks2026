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
  aliases text[] not null default '{}',
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
  role text not null default 'customer' check (role in ('customer','owner')),
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
  rationale text not null default '',
  payload jsonb not null,
  evidence jsonb not null default '[]',
  reads jsonb not null default '[]',
  confidence numeric check (confidence between 0 and 1),
  risk_flags text[] not null default '{}',
  short_code text unique,
  owner_notified_at timestamptz,
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
  square_order_id text,             -- shared by both orders of a split counteroffer
  square_payment_link_id text,
  payment_url text,
  proposal_id uuid references proposals(id),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index orders_square_idx on orders (square_order_id);
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
