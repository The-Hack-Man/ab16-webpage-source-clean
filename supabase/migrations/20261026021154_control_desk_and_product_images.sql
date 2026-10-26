-- Add a small, auditable Control Desk workflow and secure product image storage.

-- This schema bootstrap is not a launch approval: keep every staging item unsaleable.
alter table public.products alter column available_for_sale set default false;
update public.products set available_for_sale = false where available_for_sale is distinct from false;

create table if not exists public.control_desk_runs (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  job_id uuid references public.jobs(id) on delete set null,
  result jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.jobs add column if not exists source_event_id uuid references public.outbox(id) on delete set null;
create unique index if not exists jobs_source_event_id_uidx
  on public.jobs (source_event_id) where source_event_id is not null;
create index if not exists control_desk_runs_created_idx
  on public.control_desk_runs (created_at desc);

alter table public.control_desk_runs enable row level security;
drop policy if exists "control_desk_runs_admin_select" on public.control_desk_runs;
create policy "control_desk_runs_admin_select" on public.control_desk_runs
  for select to authenticated using (public.is_admin());

-- The RPC keeps run creation and its outbox event in one transaction.
create or replace function public.request_control_desk_health_check()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  run_id uuid := gen_random_uuid();
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  insert into public.control_desk_runs (id, requested_by)
  values (run_id, auth.uid());

  insert into public.outbox (event_type, payload, version, correlation_id, idempotency_key)
  values (
    'control_desk.health_check.requested',
    jsonb_build_object('schemaVersion', 1, 'runId', run_id),
    1,
    run_id,
    'control-desk-health-check:' || run_id::text
  );

  return run_id;
end;
$$;

revoke all on function public.request_control_desk_health_check() from public, anon;
grant execute on function public.request_control_desk_health_check() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public_read_product_images" on storage.objects;
create policy "public_read_product_images" on storage.objects
  for select to public using (bucket_id = 'product-images');

drop policy if exists "admin_insert_product_images" on storage.objects;
create policy "admin_insert_product_images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "admin_update_product_images" on storage.objects;
create policy "admin_update_product_images" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "admin_delete_product_images" on storage.objects;
create policy "admin_delete_product_images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
