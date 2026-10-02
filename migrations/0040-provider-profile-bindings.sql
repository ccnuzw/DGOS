ALTER TABLE provider_configs
  ADD COLUMN IF NOT EXISTS capability_protocol_id text,
  ADD COLUMN IF NOT EXISTS capability_protocol_version text,
  ADD CONSTRAINT provider_config_profile_pair CHECK ((capability_protocol_id IS NULL) = (capability_protocol_version IS NULL));
