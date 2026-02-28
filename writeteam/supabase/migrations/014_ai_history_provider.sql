ALTER TABLE ai_history
  ADD COLUMN IF NOT EXISTS provider TEXT;

CREATE INDEX IF NOT EXISTS idx_ai_history_user_created_provider
  ON ai_history(user_id, created_at DESC, provider);
