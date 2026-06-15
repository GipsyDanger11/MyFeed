-- MyFeed migration 0002
-- Fix the 403 (Forbidden) the mobile app hits when trying to insert its own
-- automation_logs rows in demo mode, and add the relevance_score column
-- the Groq scoring feature writes.
--
-- Apply via: Supabase Dashboard → SQL editor → New query → paste → Run.
-- Or with the Supabase CLI: `supabase db push`.

-- 1) Allow the mobile app (authenticated user) to write its own logs.
create policy "Users can insert own logs"
  on public.automation_logs for insert
  with check (auth.uid() = user_id);

-- 2) Allow the user to update/delete their own logs (so future "undo" or
--    "retry" actions can clean up). Worker still uses the service role
--    which bypasses RLS entirely.
create policy "Users can update own logs"
  on public.automation_logs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own logs"
  on public.automation_logs for delete
  using (auth.uid() = user_id);

-- 3) Relevance score column used by the Groq content-relevance feature.
alter table public.automation_logs
  add column if not exists relevance_score integer;

-- 4) Enable Realtime for the dashboard's live activity feed. The default
--    Supabase Realtime publication does not auto-include new tables, so
--    we add automation_logs explicitly.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'automation_logs'
  ) then
    execute 'alter publication supabase_realtime add table public.automation_logs';
  end if;
end $$;
