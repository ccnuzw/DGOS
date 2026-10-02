ALTER TABLE action_runs ADD COLUMN IF NOT EXISTS input_payload jsonb;
CREATE INDEX IF NOT EXISTS action_runs_unclaimed_idx ON action_runs(created_at) WHERE state = 'queued' AND handler_claimed = false;
