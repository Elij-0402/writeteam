-- WriteTeam Database Schema
-- Supabase Migration

-- Profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Projects table
create table if not exists public.projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text,
  genre text,
  cover_image_url text,
  word_count_goal integer,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.projects enable row level security;

create policy "Users can view own projects"
  on public.projects for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own projects"
  on public.projects for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own projects"
  on public.projects for update
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can delete own projects"
  on public.projects for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Documents table
create table if not exists public.documents (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null default 'Untitled',
  content jsonb,
  content_text text,
  word_count integer default 0,
  sort_order integer default 0,
  document_type text default 'chapter' check (document_type in ('chapter', 'scene', 'note', 'draft')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.documents enable row level security;

create policy "Users can view own documents"
  on public.documents for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own documents"
  on public.documents for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own documents"
  on public.documents for update
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can delete own documents"
  on public.documents for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Characters table
create table if not exists public.characters (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  role text,
  description text,
  personality text,
  appearance text,
  backstory text,
  goals text,
  relationships text,
  notes text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.characters enable row level security;

create policy "Users can view own characters"
  on public.characters for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own characters"
  on public.characters for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own characters"
  on public.characters for update
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can delete own characters"
  on public.characters for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Story Bibles table
create table if not exists public.story_bibles (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null unique,
  user_id uuid references auth.users(id) on delete cascade not null,
  braindump text,
  genre text,
  style text,
  synopsis text,
  themes text,
  setting text,
  pov text,
  tense text,
  worldbuilding text,
  outline jsonb,
  notes text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.story_bibles enable row level security;

create policy "Users can view own story bibles"
  on public.story_bibles for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own story bibles"
  on public.story_bibles for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own story bibles"
  on public.story_bibles for update
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can delete own story bibles"
  on public.story_bibles for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- AI History table
create table if not exists public.ai_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  project_id uuid references public.projects(id) on delete cascade not null,
  document_id uuid references public.documents(id) on delete set null,
  feature text not null,
  prompt text not null,
  result text not null,
  model text,
  tokens_used integer,
  created_at timestamptz default now() not null
);

alter table public.ai_history enable row level security;

create policy "Users can view own ai history"
  on public.ai_history for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own ai history"
  on public.ai_history for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- Indexes for performance
create index if not exists idx_projects_user_id on public.projects(user_id);
create index if not exists idx_documents_project_id on public.documents(project_id);
create index if not exists idx_documents_user_id on public.documents(user_id);
create index if not exists idx_characters_project_id on public.characters(project_id);
create index if not exists idx_story_bibles_project_id on public.story_bibles(project_id);
create index if not exists idx_ai_history_project_id on public.ai_history(project_id);
create index if not exists idx_ai_history_user_id on public.ai_history(user_id);
