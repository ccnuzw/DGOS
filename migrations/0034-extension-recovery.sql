CREATE TABLE IF NOT EXISTS extension_connection_intents (
  intent_id uuid PRIMARY KEY,
  subject_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind = 'mcp'),
  extension_id text NOT NULL,
  extension_version text NOT NULL,
  config_digest text NOT NULL,
  action text NOT NULL CHECK (action IN ('connect','disconnect')),
  state text NOT NULL CHECK (state IN ('queued','claimed','completed','failed')),
  lease_owner text,
  lease_until timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (subject_id, kind, extension_id, intent_id)
);
CREATE INDEX IF NOT EXISTS extension_connection_intents_work_idx ON extension_connection_intents(state, lease_until, created_at);
ALTER TABLE extension_installs DROP CONSTRAINT IF EXISTS extension_installs_connection_state_check;
ALTER TABLE extension_installs ADD CONSTRAINT extension_installs_connection_state_check CHECK (connection_state IN ('stopped','needs-credentials','connecting','connected','stopping','failed'));
CREATE TABLE IF NOT EXISTS extension_secret_revoke_intents (
  intent_id uuid PRIMARY KEY,
  subject_id uuid NOT NULL,
  kind text NOT NULL,
  extension_id text NOT NULL,
  secret_ref text NOT NULL,
  state text NOT NULL CHECK (state IN ('pending','completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS extension_secret_revoke_pending_idx ON extension_secret_revoke_intents(state, created_at);
CREATE TABLE IF NOT EXISTS extension_confirmations (
  confirmation_id uuid PRIMARY KEY,
  subject_id uuid NOT NULL,
  app_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('skill','mcp')),
  extension_id text NOT NULL,
  operation_id text NOT NULL,
  extension_version text NOT NULL,
  input_digest text NOT NULL,
  request_id uuid NOT NULL,
  state text NOT NULL CHECK (state IN ('pending','approved','consumed','denied')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(subject_id,request_id)
);
