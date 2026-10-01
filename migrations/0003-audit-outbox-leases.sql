-- Durable audit outbox publishing leases. Expand-only.
ALTER TABLE audit_outbox ADD COLUMN IF NOT EXISTS lease_owner text;
ALTER TABLE audit_outbox ADD COLUMN IF NOT EXISTS lease_until timestamptz;
CREATE INDEX IF NOT EXISTS audit_outbox_claim_idx ON audit_outbox (published_at, next_attempt_at, lease_until);
