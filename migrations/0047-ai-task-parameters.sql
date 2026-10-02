ALTER TABLE ai_tasks
  ADD COLUMN IF NOT EXISTS execution_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS execution_digest text;

ALTER TABLE ai_tasks
  ADD CONSTRAINT ai_tasks_execution_snapshot_pair
  CHECK ((execution_snapshot IS NULL) = (execution_digest IS NULL));
