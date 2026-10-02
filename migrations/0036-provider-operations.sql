DO $$ BEGIN
  IF to_regclass('provider_accounts') IS NULL OR to_regclass('provider_configs') IS NULL THEN
    RAISE EXCEPTION '0036 requires provider account/config tables';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS provider_secret_revoke_intents (
  intent_id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES provider_accounts(account_id),
  secret_ref text NOT NULL,
  state text NOT NULL CHECK (state IN ('pending','completed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(account_id, secret_ref)
);
CREATE INDEX IF NOT EXISTS provider_secret_revoke_pending_idx
  ON provider_secret_revoke_intents(created_at) WHERE state='pending';

CREATE TABLE IF NOT EXISTS provider_text_profiles (
  profile_id text NOT NULL,
  version bigint NOT NULL CHECK (version > 0),
  owner_id uuid NOT NULL REFERENCES admin_principals(principal_id),
  protocol_type text NOT NULL,
  status text NOT NULL CHECK (status IN ('draft','active','disabled')),
  digest text NOT NULL,
  declaration jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(profile_id, version),
  UNIQUE(owner_id, profile_id, version)
);
CREATE INDEX IF NOT EXISTS provider_text_profiles_directory_idx
  ON provider_text_profiles(owner_id, status, profile_id, version DESC);
