-- Runtime persistence extensions. 0006 remains immutable.
ALTER TABLE app_versions ADD COLUMN IF NOT EXISTS trust_level text NOT NULL DEFAULT 'official';
ALTER TABLE app_versions ADD COLUMN IF NOT EXISTS uninstall_policy text NOT NULL DEFAULT 'allowed';
ALTER TABLE app_versions ADD COLUMN IF NOT EXISTS data_version text;
ALTER TABLE app_versions ADD COLUMN IF NOT EXISTS migration_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE app_installs ADD COLUMN IF NOT EXISTS previous_app_version_id uuid REFERENCES app_versions(app_version_id);
ALTER TABLE app_installs ADD COLUMN IF NOT EXISTS active_app_version_id uuid REFERENCES app_versions(app_version_id);
ALTER TABLE app_installs ADD COLUMN IF NOT EXISTS install_id uuid;
ALTER TABLE app_installs ADD COLUMN IF NOT EXISTS last_health jsonb;
ALTER TABLE app_installs ADD COLUMN IF NOT EXISTS request_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS app_installs_request_id_uq ON app_installs(subject_id, request_id) WHERE request_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS permission_requests (
  request_id uuid PRIMARY KEY, subject_id uuid NOT NULL, app_id text NOT NULL,
  capability text NOT NULL, scope text NOT NULL DEFAULT '*', state text NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending','approved','denied','expired')),
  expires_at timestamptz NOT NULL, policy_version bigint NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS permission_requests_lookup ON permission_requests(subject_id, app_id, capability, scope, state);
CREATE TABLE IF NOT EXISTS action_definitions (
  action_id text NOT NULL, action_version bigint NOT NULL, owner_app_id text NOT NULL,
  definition jsonb NOT NULL, enabled boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(action_id, action_version)
);
CREATE TABLE IF NOT EXISTS action_plans (
  plan_id uuid PRIMARY KEY, request_id uuid NOT NULL, subject_id uuid NOT NULL, action_id text NOT NULL,
  action_version bigint NOT NULL, input_digest text NOT NULL, risk text NOT NULL,
  confirmation_required boolean NOT NULL, confirmation_state text NOT NULL DEFAULT 'pending',
  input_summary jsonb NOT NULL DEFAULT '[]'::jsonb, expires_at timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'planned', created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(subject_id, request_id)
);
ALTER TABLE action_runs ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES action_plans(plan_id);
ALTER TABLE action_runs ADD COLUMN IF NOT EXISTS action_version bigint;
ALTER TABLE action_runs ADD COLUMN IF NOT EXISTS input_digest text;
ALTER TABLE action_runs ADD COLUMN IF NOT EXISTS timeout_at timestamptz;
ALTER TABLE action_runs ADD COLUMN IF NOT EXISTS cancel_request_id uuid;
ALTER TABLE action_runs ADD COLUMN IF NOT EXISTS result_summary jsonb;
ALTER TABLE action_runs ADD COLUMN IF NOT EXISTS error_summary text;
CREATE TABLE IF NOT EXISTS system_settings (
  scope_id uuid PRIMARY KEY, settings_version bigint NOT NULL DEFAULT 1,
  context_version bigint NOT NULL DEFAULT 1, settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS system_setting_events (
  event_id uuid PRIMARY KEY, scope_id uuid NOT NULL, context_version bigint NOT NULL,
  domain text NOT NULL, restart_required boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
