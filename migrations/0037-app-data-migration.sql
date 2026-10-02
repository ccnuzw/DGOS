CREATE TABLE IF NOT EXISTS app_data_migrations (
  migration_id uuid PRIMARY KEY,
  subject_id uuid NOT NULL,
  app_id text NOT NULL,
  request_id uuid,
  from_version bigint NOT NULL,
  to_version bigint NOT NULL,
  state text NOT NULL CHECK (state IN ('prepared','committed','rolled_back')),
  before_digest text NOT NULL,
  after_digest text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS app_data_migrations_pending_idx ON app_data_migrations(subject_id,app_id) WHERE state='prepared';
