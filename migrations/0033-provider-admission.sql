DO $$ BEGIN
  IF to_regclass('provider_configs') IS NULL OR to_regclass('model_catalogs') IS NULL THEN RAISE EXCEPTION '0033 requires provider config and catalog tables (0007)'; END IF;
END $$;
CREATE INDEX IF NOT EXISTS provider_configs_ready_owner_idx ON provider_configs(owner_id,provider_config_id) WHERE status='ready';
CREATE INDEX IF NOT EXISTS model_catalogs_fresh_idx ON model_catalogs(provider_config_id,catalog_version DESC) WHERE status='fresh';
