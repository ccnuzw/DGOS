CREATE TABLE IF NOT EXISTS governance_policy (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  policy_version bigint NOT NULL DEFAULT 1 CHECK (policy_version > 0),
  audit_retention_days integer NOT NULL DEFAULT 180 CHECK (audit_retention_days >= 180),
  cache_retention_days integer NOT NULL DEFAULT 30 CHECK (cache_retention_days >= 30),
  revoked_session_retention_days integer NOT NULL DEFAULT 30 CHECK (revoked_session_retention_days >= 30),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO governance_policy (singleton) VALUES (true) ON CONFLICT (singleton) DO NOTHING;
ALTER TABLE retention_jobs ADD COLUMN IF NOT EXISTS policy_version bigint;
ALTER TABLE retention_jobs ADD COLUMN IF NOT EXISTS request_id uuid;
ALTER TABLE retention_jobs ADD COLUMN IF NOT EXISTS actor_id uuid;
ALTER TABLE retention_jobs ADD COLUMN IF NOT EXISTS failure_count integer NOT NULL DEFAULT 0 CHECK (failure_count >= 0);
