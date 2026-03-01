-- Canvas nodes
create table if not exists public.canvas_nodes (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  node_type text not null default 'beat' check (node_type in ('beat', 'scene', 'character', 'location', 'note')),
  label text not null,
  content text,
  position_x float default 0,
  position_y float default 0,
  width float default 200,
  height float default 100,
  color text,
  metadata jsonb,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.canvas_nodes enable row level security;
create policy "Users can view own canvas nodes" on public.canvas_nodes for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert own canvas nodes" on public.canvas_nodes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own canvas nodes" on public.canvas_nodes for update to authenticated using ((select auth.uid()) = user_id);
create policy "Users can delete own canvas nodes" on public.canvas_nodes for delete to authenticated using ((select auth.uid()) = user_id);

-- Canvas edges
create table if not exists public.canvas_edges (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  source_node_id uuid references public.canvas_nodes(id) on delete cascade not null,
  target_node_id uuid references public.canvas_nodes(id) on delete cascade not null,
  label text,
  edge_type text,
  created_at timestamptz default now() not null
);

alter table public.canvas_edges enable row level security;
create policy "Users can view own canvas edges" on public.canvas_edges for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert own canvas edges" on public.canvas_edges for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own canvas edges" on public.canvas_edges for update to authenticated using ((select auth.uid()) = user_id);
create policy "Users can delete own canvas edges" on public.canvas_edges for delete to authenticated using ((select auth.uid()) = user_id);

create index if not exists idx_canvas_nodes_project on public.canvas_nodes(project_id);
create index if not exists idx_canvas_edges_project on public.canvas_edges(project_id);
