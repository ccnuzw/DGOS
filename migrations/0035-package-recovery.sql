ALTER TABLE app_package_deployments ADD COLUMN IF NOT EXISTS actions_synced boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS app_package_operations_prepared_idx ON app_package_operations(subject_id,app_id) WHERE state='prepared';
