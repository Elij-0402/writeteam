-- Add dialogue_style and tags columns to characters table
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS dialogue_style text,
  ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.characters.dialogue_style IS 'Character speech patterns, catchphrases, and verbal habits';
COMMENT ON COLUMN public.characters.tags IS 'Free-form tags for filtering and grouping (JSON array of strings)';
