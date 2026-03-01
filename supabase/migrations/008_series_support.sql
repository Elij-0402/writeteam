-- Sprint 3: Series Support — series, series_bibles, and project/character linkage

-- Series table
create table if not exists public.series (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.series enable row level security;

create policy "Users can view own series"
  on public.series for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own series"
  on public.series for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own series"
  on public.series for update
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can delete own series"
  on public.series for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Series Bibles table
create table if not exists public.series_bibles (
  id uuid default gen_random_uuid() primary key,
  series_id uuid references public.series(id) on delete cascade not null unique,
  user_id uuid references auth.users(id) on delete cascade not null,
  genre text,
  style text,
  themes text,
  setting text,
  worldbuilding text,
  notes text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.series_bibles enable row level security;

create policy "Users can view own series bibles"
  on public.series_bibles for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own series bibles"
  on public.series_bibles for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own series bibles"
  on public.series_bibles for update
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can delete own series bibles"
  on public.series_bibles for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Link projects to series
alter table public.projects
  add column if not exists series_id uuid references public.series(id) on delete set null;

-- Link characters to series (shared characters across books)
alter table public.characters
  add column if not exists series_id uuid references public.series(id) on delete set null;

-- Indexes
create index if not exists idx_series_user_id on public.series(user_id);
create index if not exists idx_series_bibles_series_id on public.series_bibles(series_id);
create index if not exists idx_projects_series_id on public.projects(series_id);
create index if not exists idx_characters_series_id on public.characters(series_id);
