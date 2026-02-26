create table if not exists public.images (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  prompt text not null,
  image_url text not null,
  style text,
  source_text text,
  created_at timestamptz default now() not null
);

alter table public.images enable row level security;
create policy "Users can view own images" on public.images for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert own images" on public.images for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can delete own images" on public.images for delete to authenticated using ((select auth.uid()) = user_id);

create index if not exists idx_images_project on public.images(project_id);
