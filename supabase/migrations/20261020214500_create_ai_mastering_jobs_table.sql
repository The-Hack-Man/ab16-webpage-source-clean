/*
# AI Mastering jobs table — proper CREATE TABLE

The ai_mastering_jobs table was previously created manually in the Supabase
dashboard. This migration ensures it can be recreated on a fresh database
restore or in a CI/staging environment.

This migration creates the base table with core columns and indexes. The later
repair migration (20261021120000_repair_ai_mastering_jobs.sql) validates the
schema against the existing production table and adds CHECK constraints,
Stripe columns, and improved RLS policies.

If the table already exists (e.g., created manually or by this migration),
this migration uses IF NOT EXISTS / IF NOT EXISTS guards so it is safe to
re-run. The repair migration then reconciles any schema differences.
*/

create table if not exists public.ai_mastering_jobs (
  id uuid primary key default gen_random_uuid(),
  release_id uuid references public.music_releases(id) on delete set null,
  track_title text not null,
  preset text not null default 'balanced',
  status text not null default 'pending',
  input_url text,
  output_url text,
  stripe_session_id text,
  payment_intent_id text,
  paid boolean not null default false,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.ai_mastering_jobs enable row level security;

create index if not exists ai_mastering_jobs_release_idx on public.ai_mastering_jobs (release_id);
create index if not exists ai_mastering_jobs_status_idx on public.ai_mastering_jobs (status);
create index if not exists ai_mastering_jobs_stripe_session_idx on public.ai_mastering_jobs (stripe_session_id);
create index if not exists ai_mastering_jobs_paid_idx on public.ai_mastering_jobs (paid);

select 'ai_mastering_jobs base table created (repair migration will add CHECK constraints)' as status;
