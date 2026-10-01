-- Connection test worker leases. Expand-only and safe to run after 0001.
ALTER TABLE connection_tests ADD COLUMN IF NOT EXISTS lease_owner text;
ALTER TABLE connection_tests ADD COLUMN IF NOT EXISTS lease_until timestamptz;
ALTER TABLE connection_tests ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0);
CREATE INDEX IF NOT EXISTS connection_tests_claim_idx ON connection_tests (state, lease_until, created_at);
