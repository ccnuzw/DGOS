-- Existing binding rows remain intact; new bindings require a real config reference.
DO $$ BEGIN
  IF to_regclass('provider_configs') IS NULL THEN RAISE EXCEPTION '0031 requires provider_configs (0007)'; END IF;
END $$;
CREATE INDEX IF NOT EXISTS provider_bindings_config_active_idx ON provider_bindings(provider_config_id) WHERE state='active';
CREATE INDEX IF NOT EXISTS provider_configs_account_idx ON provider_configs(provider_account_id,status);
