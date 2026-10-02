CREATE TABLE IF NOT EXISTS permission_change_receipts (
  request_id uuid PRIMARY KEY,
  fingerprint text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS package_action_bindings (
  subject_id uuid NOT NULL,
  app_id text NOT NULL,
  action_id text NOT NULL,
  action_version bigint NOT NULL CHECK (action_version > 0),
  declaration_version text NOT NULL,
  handler_id text NOT NULL,
  package_digest text NOT NULL,
  definition jsonb NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subject_id, app_id, action_id)
);
CREATE INDEX IF NOT EXISTS package_action_bindings_enabled_idx ON package_action_bindings (action_id, enabled);
