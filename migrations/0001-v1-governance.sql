-- V1 foundation migration. PostgreSQL 14+.
-- Expand phase only: no destructive changes and safe to run before application cutover.

CREATE TABLE IF NOT EXISTS dgos_schema_migrations (
  version text PRIMARY KEY,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_principals (
  principal_id uuid PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('invited', 'active', 'suspended', 'revoked')),
  credential_ref text NOT NULL,
  roles jsonb NOT NULL DEFAULT '[]'::jsonb,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_principals_active_idx
  ON admin_principals ((status)) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS admin_sessions (
  session_id uuid PRIMARY KEY,
  principal_id uuid NOT NULL REFERENCES admin_principals(principal_id),
  state text NOT NULL CHECK (state IN ('created', 'active', 'expired', 'revoked')),
  session_version bigint NOT NULL DEFAULT 1 CHECK (session_version > 0),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_sessions_principal_idx ON admin_sessions (principal_id, state);

CREATE TABLE IF NOT EXISTS api_key_records (
  key_id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES admin_principals(principal_id),
  prefix text NOT NULL,
  digest text NOT NULL UNIQUE,
  scope jsonb NOT NULL,
  rotation_group uuid NOT NULL,
  state text NOT NULL CHECK (state IN ('active', 'expired', 'revoked')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS api_key_owner_idx ON api_key_records (owner_id, state);

CREATE TABLE IF NOT EXISTS provider_accounts (
  account_id uuid PRIMARY KEY,
  owner_type text NOT NULL,
  owner_id uuid NOT NULL,
  protocol_type text NOT NULL,
  display_name text NOT NULL,
  credential_ref text NOT NULL,
  scope jsonb NOT NULL,
  state text NOT NULL CHECK (state IN ('draft', 'credential_pending', 'ready', 'error', 'disabled', 'revoked')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS provider_account_owner_protocol_name_idx
  ON provider_accounts (owner_type, owner_id, protocol_type, display_name);

CREATE TABLE IF NOT EXISTS provider_bindings (
  binding_id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES provider_accounts(account_id),
  provider_config_id uuid NOT NULL,
  policy_version bigint NOT NULL,
  state text NOT NULL CHECK (state IN ('active', 'unbound')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, provider_config_id)
);

CREATE TABLE IF NOT EXISTS connection_tests (
  test_id uuid PRIMARY KEY,
  request_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES provider_accounts(account_id),
  account_version bigint NOT NULL,
  config_version bigint NOT NULL,
  protocol_version text NOT NULL,
  state text NOT NULL CHECK (state IN ('queued', 'running', 'succeeded', 'failed', 'timed_out', 'cancelled')),
  reason_code text,
  endpoint_digest text,
  duration_ms integer CHECK (duration_ms IS NULL OR duration_ms >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  UNIQUE (request_id, account_id, account_version, config_version)
);

CREATE TABLE IF NOT EXISTS audit_events (
  event_id uuid PRIMARY KEY,
  request_id uuid NOT NULL,
  actor_type text NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  result text NOT NULL,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  policy_version bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_events_created_idx ON audit_events (created_at, event_id);

CREATE TABLE IF NOT EXISTS quota_reservations (
  reservation_id uuid PRIMARY KEY,
  scope_type text NOT NULL,
  scope_id uuid NOT NULL,
  task_id uuid NOT NULL,
  attempt_id uuid NOT NULL,
  metric text NOT NULL,
  amount numeric(20, 6) NOT NULL CHECK (amount >= 0),
  state text NOT NULL CHECK (state IN ('reserved', 'settled', 'released', 'needs_review')),
  policy_version bigint NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, attempt_id, metric)
);

CREATE TABLE IF NOT EXISTS usage_events (
  usage_event_id uuid PRIMARY KEY,
  task_id uuid NOT NULL,
  attempt_id uuid NOT NULL,
  metric text NOT NULL,
  amount numeric(20, 6) NOT NULL CHECK (amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, attempt_id, metric)
);

CREATE TABLE IF NOT EXISTS audit_outbox (
  event_id uuid PRIMARY KEY REFERENCES audit_events(event_id),
  published_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO dgos_schema_migrations (version, checksum)
VALUES ('0001-v1-governance', 'pending-checksum-generated-by-release-tool')
ON CONFLICT (version) DO NOTHING;
