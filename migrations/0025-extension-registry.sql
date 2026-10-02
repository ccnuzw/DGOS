CREATE TABLE IF NOT EXISTS extension_previews (
  preview_id uuid PRIMARY KEY, subject_id uuid NOT NULL, request_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('skill','mcp')),
  source_ref text NOT NULL, digest text NOT NULL, manifest jsonb NOT NULL,
  trust_state text NOT NULL CHECK (trust_state IN ('trusted','untrusted')),
  expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(subject_id, request_id)
);
CREATE TABLE IF NOT EXISTS extension_installs (
  subject_id uuid NOT NULL, kind text NOT NULL CHECK (kind IN ('skill','mcp')),
  extension_id text NOT NULL, package_id text, version text NOT NULL,
  source_ref text NOT NULL, manifest_digest text NOT NULL, manifest jsonb NOT NULL,
  state text NOT NULL CHECK (state IN ('installed','enabled','disabled','removed')),
  connection_state text NOT NULL DEFAULT 'stopped' CHECK (connection_state IN ('stopped','needs-credentials','connecting','connected','failed')),
  config jsonb NOT NULL DEFAULT '{}', credential_ref text,
  tool_catalog jsonb NOT NULL DEFAULT '[]', state_version bigint NOT NULL DEFAULT 1,
  connection_attempt_id uuid, updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(subject_id, kind, extension_id)
);
CREATE TABLE IF NOT EXISTS extension_mutations (
  subject_id uuid NOT NULL, request_id uuid NOT NULL, operation text NOT NULL,
  fingerprint text NOT NULL, result jsonb NOT NULL,
  PRIMARY KEY(subject_id, request_id)
);
