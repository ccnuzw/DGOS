ALTER TABLE ai_tasks ADD COLUMN IF NOT EXISTS input_text text;
ALTER TABLE ai_task_attempts ADD COLUMN IF NOT EXISTS lease_owner text;
ALTER TABLE ai_task_attempts ADD COLUMN IF NOT EXISTS lease_until timestamptz;
ALTER TABLE ai_task_attempts ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS ai_task_attempts_claim_idx ON ai_task_attempts(state, lease_until, task_id);
