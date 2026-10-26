-- Staging checkout prerequisites only. Service-role-only webhook idempotency.
alter table public.orders
  add column if not exists owner_order_notified_at timestamptz;

alter table public.processed_stripe_events
  add column if not exists status text not null default 'completed',
  add column if not exists attempts integer not null default 0,
  add column if not exists last_error text,
  add column if not exists locked_until timestamptz,
  add column if not exists completed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.processed_stripe_events'::regclass
      and conname = 'processed_stripe_events_status_check'
  ) then
    alter table public.processed_stripe_events
      add constraint processed_stripe_events_status_check
      check (status in ('processing', 'completed', 'failed'));
  end if;
end $$;

create or replace function public.claim_stripe_event_v2(p_event_id text)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_claimed text;
  v_status text;
begin
  if p_event_id is null or length(trim(p_event_id)) = 0 then
    raise exception 'Stripe event ID is required';
  end if;

  insert into public.processed_stripe_events
    (stripe_event_id, processed_at, status, attempts, locked_until, last_error, completed_at)
  values
    (p_event_id, now(), 'processing', 1, now() + interval '5 minutes', null, null)
  on conflict (stripe_event_id) do update
    set processed_at = now(),
        status = 'processing',
        attempts = public.processed_stripe_events.attempts + 1,
        locked_until = now() + interval '5 minutes',
        last_error = null
    where public.processed_stripe_events.status <> 'completed'
      and (public.processed_stripe_events.status = 'failed'
        or public.processed_stripe_events.locked_until is null
        or public.processed_stripe_events.locked_until < now())
  returning stripe_event_id into v_claimed;

  if v_claimed is not null then return 'claimed'; end if;

  select status into v_status
  from public.processed_stripe_events
  where stripe_event_id = p_event_id;

  if v_status = 'completed' then return 'completed'; end if;
  return 'locked';
end;
$function$;

create or replace function public.mark_stripe_event_completed(p_event_id text)
returns void
language sql
security definer
set search_path to 'public', 'pg_temp'
as $function$
  update public.processed_stripe_events
  set status = 'completed', completed_at = now(), processed_at = now(), locked_until = null, last_error = null
  where stripe_event_id = p_event_id;
$function$;

create or replace function public.mark_stripe_event_failed(p_event_id text, p_error text default null)
returns void
language sql
security definer
set search_path to 'public', 'pg_temp'
as $function$
  update public.processed_stripe_events
  set status = 'failed', processed_at = now(), locked_until = null,
      last_error = left(coalesce(p_error, 'Unknown webhook failure'), 2000)
  where stripe_event_id = p_event_id and status <> 'completed';
$function$;

revoke all on function public.claim_stripe_event_v2(text) from public, anon, authenticated;
revoke all on function public.mark_stripe_event_completed(text) from public, anon, authenticated;
revoke all on function public.mark_stripe_event_failed(text, text) from public, anon, authenticated;
grant execute on function public.claim_stripe_event_v2(text) to service_role;
grant execute on function public.mark_stripe_event_completed(text) to service_role;
grant execute on function public.mark_stripe_event_failed(text, text) to service_role;
