CREATE TABLE IF NOT EXISTS app_package_deployments (
  subject_id uuid NOT NULL,
  app_id text NOT NULL,
  package_id uuid NOT NULL REFERENCES app_package_releases(package_id),
  version text NOT NULL,
  build bigint NOT NULL CHECK (build >= 0),
  release_channel text NOT NULL,
  package_digest text NOT NULL,
  previous_digest text,
  state text NOT NULL CHECK (state IN ('active','uninstalled')),
  data_retained boolean NOT NULL DEFAULT true,
  request_id uuid,
  version_number bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(subject_id,app_id)
);
