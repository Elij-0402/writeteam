-- Add visibility settings to story_bibles
-- Controls which fields are injected into AI prompts
alter table public.story_bibles
  add column if not exists visibility jsonb default '{}'::jsonb;
