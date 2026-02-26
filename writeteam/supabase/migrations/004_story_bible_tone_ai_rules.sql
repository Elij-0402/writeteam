-- Add tone and ai_rules columns to story_bibles
ALTER TABLE public.story_bibles
  ADD COLUMN IF NOT EXISTS tone text,
  ADD COLUMN IF NOT EXISTS ai_rules text;
