CREATE TABLE IF NOT EXISTS app_package_operations (
  operation_id uuid PRIMARY KEY,
  subject_id uuid,
  app_id text NOT NULL,
  request_id uuid,
  actor_id uuid,
  action text NOT NULL CHECK (action IN ('install','uninstall')),
  state text NOT NULL CHECK (state IN ('prepared','active','uninstalled','rolled_back','rejected')),
  package_digest text,
  reason text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_package_operations_lookup ON app_package_operations(subject_id,app_id,occurred_at DESC);
