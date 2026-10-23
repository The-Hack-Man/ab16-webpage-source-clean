/*
# Engine durability SQL functions

Atomic claim functions for the jobs and outbox tables.
These ensure safe concurrent worker access with FOR UPDATE SKIP LOCKED.
*/

-- Claim the next unprocessed outbox entry atomically
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

-- Claim the next due job atomically
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

-- Reclaim jobs whose leases have expired
create or replace function public.reclaim_expired_jobs(
  p_now timestamptz
)
returns int
language plpgsql
as $$
declare
  reclaimed int;
begin
  update "jobs"
  set leased_by = null,
      lease_expires_at = null,
      status = case when status = 'running' then 'pending' else status end,
      updated_at = now()
  where lease_expires_at < p_now
    and status in ('pending', 'failed', 'running');

  get diagnostics reclaimed = row_count;
  return reclaimed;
end;
$$;

-- Trigger to update updated_at on jobs table
create or replace function public.touch_updated()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_updated_jobs on jobs;
create trigger touch_updated_jobs
  before update on jobs
  for each row
  execute function public.touch_updated();

drop trigger if exists touch_updated_outbox on outbox;
create trigger touch_updated_outbox
  before update on outbox
  for each row
  execute function public.touch_updated();
