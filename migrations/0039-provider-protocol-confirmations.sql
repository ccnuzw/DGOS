ALTER TABLE provider_text_profiles
  ADD COLUMN IF NOT EXISTS state_version bigint NOT NULL DEFAULT 1 CHECK (state_version > 0);

CREATE TABLE IF NOT EXISTS provider_protocol_confirmations (
  confirmation_id uuid PRIMARY KEY,
  subject_id uuid NOT NULL REFERENCES admin_principals(principal_id),
  session_id uuid NOT NULL,
  operation text NOT NULL CHECK (operation IN ('provider.protocol.publish','provider.protocol.state')),
  resource_id text NOT NULL,
  declaration_version text NOT NULL,
  payload_digest text NOT NULL,
  request_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  UNIQUE(subject_id, request_id)
);
CREATE INDEX IF NOT EXISTS provider_protocol_confirmations_expiry_idx
  ON provider_protocol_confirmations(expires_at) WHERE consumed_at IS NULL;
