CREATE TABLE extension_skill_definitions (
  subject_id uuid NOT NULL,
  skill_id text NOT NULL,
  package_id text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('custom', 'package')),
  content jsonb NOT NULL,
  content_digest text NOT NULL,
  localized_display jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subject_id, skill_id),
  UNIQUE (subject_id, package_id, skill_id)
);

CREATE TABLE extension_translation_intents (
  subject_id uuid NOT NULL,
  request_id uuid NOT NULL,
  skill_id text NOT NULL,
  source_version bigint NOT NULL,
  source_digest text NOT NULL,
  target_locale text NOT NULL,
  fields jsonb NOT NULL,
  options jsonb NOT NULL,
  intent_digest text NOT NULL,
  task_input text NOT NULL,
  task_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subject_id, request_id)
);

CREATE TABLE extension_task_intents (
  run_id uuid PRIMARY KEY REFERENCES extension_runs(run_id),
  subject_id uuid NOT NULL,
  skill_id text NOT NULL,
  definition_version bigint NOT NULL,
  content_digest text NOT NULL,
  task_request_id uuid NOT NULL,
  task_input text NOT NULL,
  options jsonb NOT NULL,
  task_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE extension_runs ADD COLUMN task_id uuid;

CREATE TABLE extension_online_preview_bytes (
  preview_id uuid PRIMARY KEY REFERENCES extension_previews(preview_id),
  source_digest text NOT NULL,
  envelope jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE extension_secret_write_intents (
  intent_id uuid PRIMARY KEY,
  subject_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind = 'mcp'),
  extension_id text NOT NULL,
  secret_ref text NOT NULL,
  old_secret_ref text,
  request_id uuid NOT NULL,
  credential_digest text NOT NULL,
  credential_key_version integer NOT NULL CHECK (credential_key_version > 0),
  state text NOT NULL CHECK (state IN ('prepared', 'committed', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (subject_id, request_id)
);
CREATE INDEX extension_secret_write_pending_idx ON extension_secret_write_intents(state, created_at);
