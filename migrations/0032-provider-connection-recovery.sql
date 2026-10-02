DO $$ BEGIN
  IF to_regclass('connection_tests') IS NULL THEN RAISE EXCEPTION '0032 requires connection_tests (0001)'; END IF;
END $$;
ALTER TABLE connection_tests ADD COLUMN IF NOT EXISTS provider_config_id uuid REFERENCES provider_configs(provider_config_id);
ALTER TABLE connection_tests DROP CONSTRAINT IF EXISTS connection_tests_state_check;
ALTER TABLE connection_tests ADD CONSTRAINT connection_tests_state_check CHECK (state IN ('queued','running','succeeded','failed','timed_out','cancel_requested','cancelled'));
CREATE INDEX IF NOT EXISTS connection_tests_account_active_idx ON connection_tests(account_id,state,created_at) WHERE state IN ('queued','running','cancel_requested');
