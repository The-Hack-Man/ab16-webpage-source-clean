-- Secure the remaining ai_mastering_jobs admin policies that were missed by the
-- general migration. These policies were created via the repair migration
-- using the COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '')
-- pattern, which reads the client-editable JWT role claim instead of app_metadata.
--
-- Replaces them with calls to the trusted is_admin() / is_super_admin() helpers.

drop policy if exists "admin_read_mastering_jobs" on public.ai_mastering_jobs;
create policy "admin_read_mastering_jobs" on public.ai_mastering_jobs
  for select to authenticated
  using (is_admin() or is_super_admin());

drop policy if exists "admin_update_mastering_jobs" on public.ai_mastering_jobs;
create policy "admin_update_mastering_jobs" on public.ai_mastering_jobs
  for update to authenticated
  using (is_admin() or is_super_admin())
  with check (is_admin() or is_super_admin());

-- admin_write_mastering_jobs was already handled by the general migration,
-- but we recreate it here for completeness and idempotency.
drop policy if exists "admin_write_mastering_jobs" on public.ai_mastering_jobs;
create policy "admin_write_mastering_jobs" on public.ai_mastering_jobs
  for insert to authenticated
  with check (is_admin() or is_super_admin());

select 'mastering_job_policies_secured' as status;
