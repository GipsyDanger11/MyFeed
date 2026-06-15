-- MyFeed Supabase schema
-- Run this in the Supabase SQL editor (Project → SQL → New query)

-- ============= profiles =============
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  onboarded_at timestamptz,
  automation_paused boolean not null default false,
  personalization_score integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Service role bypasses RLS for the automation worker.

-- ============= preferences =============
create table if not exists public.preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  topic text not null,
  direction text not null check (direction in ('boost', 'reduce')),
  created_at timestamptz not null default now()
);

create index if not exists preferences_user_id_idx on public.preferences (user_id);

alter table public.preferences enable row level security;

create policy "Users can read own preferences"
  on public.preferences for select
  using (auth.uid() = user_id);

create policy "Users can write own preferences"
  on public.preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============= instagram_connections =============
create table if not exists public.instagram_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  username text,
  encrypted_session text,
  status text not null default 'disconnected' check (status in ('connected', 'disconnected', 'connecting', 'error')),
  last_sync timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.instagram_connections enable row level security;

create policy "Users can read own IG connection"
  on public.instagram_connections for select
  using (auth.uid() = user_id);

create policy "Users can write own IG connection"
  on public.instagram_connections for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============= automation_logs =============
create table if not exists public.automation_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  target text,
  success boolean not null default true,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists automation_logs_user_created_idx
  on public.automation_logs (user_id, created_at desc);

alter table public.automation_logs enable row level security;

create policy "Users can read own logs"
  on public.automation_logs for select
  using (auth.uid() = user_id);

-- Writes are done by the worker using the service role, which bypasses RLS.
