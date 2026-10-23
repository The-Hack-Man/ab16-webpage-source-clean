-- Fix engine durability: add missing columns to outbox + fix claim functions

-- Add missing columns to outbox table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'outbox' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.outbox ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'outbox' AND column_name = 'leased_by'
  ) THEN
    ALTER TABLE public.outbox ADD COLUMN leased_by uuid;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'outbox' AND column_name = 'lease_expires_at'
  ) THEN
    ALTER TABLE public.outbox ADD COLUMN lease_expires_at timestamptz;
  END IF;
END $$;

-- Recreate the outbox touch trigger with updated_at column now present
drop trigger if exists touch_updated_outbox on outbox;
create trigger touch_updated_outbox
  before update on outbox
  for each row
  execute function public.touch_updated();

-- Fix: claim_next_outbox — use ctid to avoid column ambiguity
create or replace function public.claim_next_outbox(
  p_now timestamptz,
  p_worker_id uuid,
  p_lease_ms int
)
returns table (
  id uuid,
  event_type text,
  payload jsonb,
  version int,
  correlation_id uuid,
  idempotency_key text,
  created_at timestamptz
)
language plpgsql
as $$
begin
  return query
  update "outbox"
  set leased_by = p_worker_id,
      lease_expires_at = p_now + (p_lease_ms || 'ms')::interval,
      updated_at = now()
  where ctid = (
    select t.ctid from "outbox" as t
    where t.processed = false
      and (t.leased_by is null or t.lease_expires_at < p_now)
    order by t.created_at
    limit 1
    for update skip locked
  )
  returning "outbox".id, "outbox".event_type, "outbox".payload, "outbox".version, "outbox".correlation_id, "outbox".idempotency_key, "outbox".created_at;
end;
$$;

-- Fix: claim_next_job — same pattern using ctid
create or replace function public.claim_next_job(
  p_now timestamptz,
  p_worker_id uuid,
  p_lease_ms int
)
returns table (
  id uuid,
  type text,
  status text,
  attempts int,
  max_attempts int,
  scheduled_for timestamptz,
  last_error text,
  correlation_id uuid,
  payload jsonb,
  leased_by uuid,
  lease_expires_at timestamptz
)
language plpgsql
as $$
begin
  return query
  update "jobs"
  set status = 'running',
      leased_by = p_worker_id,
      lease_expires_at = p_now + (p_lease_ms || 'ms')::interval,
      updated_at = now()
  where ctid = (
    select j.ctid from "jobs" as j
    where j.status in ('pending', 'failed')
      and j.scheduled_for <= p_now
      and (j.leased_by is null or j.lease_expires_at < p_now)
    order by j.scheduled_for
    limit 1
    for update skip locked
  )
  returning "jobs".id, "jobs".type, "jobs".status, "jobs".attempts, "jobs".max_attempts, "jobs".scheduled_for, "jobs".last_error, "jobs".correlation_id, "jobs".payload, "jobs".leased_by, "jobs".lease_expires_at;
end;
$$;

select 'fix v3 applied' as status;
