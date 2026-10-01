-- V1 runtime control plane: app catalog, installs, permissions and action runs.
CREATE TABLE IF NOT EXISTS app_versions (
  app_version_id uuid PRIMARY KEY,
  app_id text NOT NULL,
  version text NOT NULL,
  build text NOT NULL,
  release_channel text NOT NULL,
  catalog_state text NOT NULL CHECK (catalog_state IN ('official','pending_review','approved','rejected','withdrawn')),
  manifest jsonb NOT NULL,
  manifest_digest text NOT NULL,
  package_digest text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, version, build, release_channel)
);
CREATE TABLE IF NOT EXISTS app_installs (
  subject_id uuid NOT NULL,
  app_id text NOT NULL,
  app_version_id uuid NOT NULL REFERENCES app_versions(app_version_id),
  state text NOT NULL CHECK (state IN ('discovered','pending_review','approved','installed','active','update_pending','health_check_failed','rolled_back','uninstall_requested','uninstalled')),
  data_retained boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subject_id, app_id)
);
CREATE TABLE IF NOT EXISTS permission_decisions (
  subject_id uuid NOT NULL,
  app_id text NOT NULL,
  capability text NOT NULL,
  scope text NOT NULL DEFAULT '*',
  decision text NOT NULL CHECK (decision IN ('allow','ask','deny')),
  policy_version bigint NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subject_id, app_id, capability, scope)
);
CREATE TABLE IF NOT EXISTS action_runs (
  run_id uuid PRIMARY KEY,
  request_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  action_id text NOT NULL,
  state text NOT NULL CHECK (state IN ('planned','awaiting_confirmation','queued','running','succeeded','failed','cancel_requested','cancelled')),
  handler_calls integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_id, request_id)
);
