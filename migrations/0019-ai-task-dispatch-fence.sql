-- Precondition: 0012-ai-task-leases.sql. Expand only; old workers ignore this column.
-- Brief metadata lock. Stop old workers before relying on the dispatch fence.
ALTER TABLE ai_task_attempts ADD COLUMN IF NOT EXISTS upstream_dispatch_started_at timestamptz;
CREATE INDEX IF NOT EXISTS ai_task_attempts_uncertain_idx
  ON ai_task_attempts (state, lease_until)
  WHERE upstream_dispatch_started_at IS NOT NULL;
