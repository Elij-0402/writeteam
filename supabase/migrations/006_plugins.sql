create table if not exists public.plugins (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  project_id uuid references public.projects(id) on delete cascade,
  name text not null,
  description text,
  system_prompt text not null,
  user_prompt_template text not null,
  requires_selection boolean default false,
  max_tokens integer default 1000,
  temperature numeric(3,2) default 0.7,
  icon text,
  sort_order integer default 0,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.plugins enable row level security;

create policy "Users can view own plugins" on public.plugins for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert own plugins" on public.plugins for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own plugins" on public.plugins for update to authenticated using ((select auth.uid()) = user_id);
create policy "Users can delete own plugins" on public.plugins for delete to authenticated using ((select auth.uid()) = user_id);

create index if not exists idx_plugins_user_id on public.plugins(user_id);
create index if not exists idx_plugins_project_id on public.plugins(project_id);
