/*
# Engine durability tables: jobs + outbox + stripe event tracking

Creates the tables required for the Website Intelligence Engine's
durable event processing, workflow scheduling, and idempotent
Stripe webhook handling. These tables are separate from the core
application schema and are safe to apply incrementally.
*/

-- ─────────────────────────────────────────────────────────────────
-- jobs — durable job queue for scheduler ticks and workflow steps
-- ─────────────────────────────────────────────────────────────────
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  status text not null default 'pending' check (status in ('pending','running','completed','failed','dead')),
  attempts int not null default 0,
  max_attempts int not null default 5,
  scheduled_for timestamptz not null default now(),
  last_error text,
  correlation_id uuid,
  payload jsonb,
  leased_by uuid,
  lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jobs_status_scheduled_idx on jobs (status, scheduled_for);
create index if not exists jobs_leased_by_idx on jobs (leased_by);
create index if not exists jobs_correlation_idx on jobs (correlation_id);

-- ─────────────────────────────────────────────────────────────────
-- outbox — transactional event outbox (committed in same TX as the DB change)
-- ─────────────────────────────────────────────────────────────────
create table if not exists outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  payload jsonb not null,
  version int not null default 1,
  correlation_id uuid not null,
  idempotency_key text not null,
  processed boolean not null default false,
  processed_at timestamptz,
  error text,
  leased_by uuid,
  lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists outbox_unprocessed_idx on outbox (processed, created_at);
create index if not exists outbox_idempotency_idx on outbox (idempotency_key);

-- ─────────────────────────────────────────────────────────────────
-- processed_stripe_events — webhook idempotency tracking
-- ─────────────────────────────────────────────────────────────────
create table if not exists processed_stripe_events (
  stripe_event_id text primary key,
  processed_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────
-- RLS: these tables are admin-only, accessed via service role
-- ─────────────────────────────────────────────────────────────────
alter table jobs enable row level security;
alter table outbox enable row level security;
alter table processed_stripe_events enable row level security;

-- Only authenticated admins can manage jobs and outbox
-- Uses JWT claim: role => admin
create policy "admin_full_access_jobs" on jobs
  for all to authenticated
  using (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin')
  with check (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin');

create policy "admin_full_access_outbox" on outbox
  for all to authenticated
  using (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin')
  with check (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin');

create policy "admin_full_access_processed_stripe_events" on processed_stripe_events
  for all to authenticated
  using (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin')
  with check (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'admin');
