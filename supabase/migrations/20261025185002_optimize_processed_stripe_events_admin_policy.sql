drop policy if exists "admin_full_access_processed_stripe_events" on public.processed_stripe_events;

create policy "admin_full_access_processed_stripe_events" on public.processed_stripe_events
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
