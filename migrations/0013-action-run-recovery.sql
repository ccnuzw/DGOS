-- Action run leases make queued/running work reclaimable after worker loss.
ALTER TABLE action_runs ADD COLUMN IF NOT EXISTS lease_owner text;
ALTER TABLE action_runs ADD COLUMN IF NOT EXISTS lease_until timestamptz;
ALTER TABLE action_runs ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz;
CREATE INDEX IF NOT EXISTS action_runs_claim_idx ON action_runs(state, lease_until, created_at);
