CREATE TABLE IF NOT EXISTS provider_protocol_receipts (
  subject_id uuid NOT NULL REFERENCES admin_principals(principal_id),
  request_id uuid NOT NULL,
  session_id uuid NOT NULL,
  confirmation_id uuid NOT NULL,
  operation text NOT NULL CHECK (operation IN ('provider.protocol.publish','provider.protocol.state')),
  resource_id text NOT NULL,
  declaration_version text NOT NULL,
  payload_digest text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(subject_id, request_id)
);
