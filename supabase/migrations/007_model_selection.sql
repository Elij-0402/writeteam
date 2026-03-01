-- Sprint 3: Model Selection — add preferred_model to projects
alter table public.projects add column if not exists preferred_model text default 'gpt-4o-mini';
