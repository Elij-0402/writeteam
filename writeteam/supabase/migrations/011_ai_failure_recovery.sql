-- 011_ai_failure_recovery.sql
-- Story 1.4: AI 失败恢复闭环 - 扩展 ai_history 错误遥测字段

ALTER TABLE ai_history ADD COLUMN IF NOT EXISTS error_type TEXT;
ALTER TABLE ai_history ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE ai_history ADD COLUMN IF NOT EXISTS is_retry BOOLEAN DEFAULT FALSE;
ALTER TABLE ai_history ADD COLUMN IF NOT EXISTS recovery_status TEXT;
ALTER TABLE ai_history ADD COLUMN IF NOT EXISTS attempted_model TEXT;

-- recovery_status 值域: 'success', 'failure', 'recovered_retry', 'recovered_switch', 'unrecovered'
-- 所有新列可 NULL（向后兼容已有数据）
