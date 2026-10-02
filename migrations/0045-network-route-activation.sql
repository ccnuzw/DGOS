CREATE TABLE IF NOT EXISTS network_route_targets (
  scope_id uuid PRIMARY KEY REFERENCES system_settings(scope_id) ON DELETE CASCADE,
  target_version bigint NOT NULL CHECK (target_version > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS network_route_instances (
  scope_id uuid NOT NULL REFERENCES system_settings(scope_id) ON DELETE CASCADE,
  instance_id uuid NOT NULL,
  service_role text NOT NULL CHECK (service_role IN ('api', 'worker')),
  settings_version bigint NOT NULL CHECK (settings_version > 0),
  effective_route text NOT NULL CHECK (effective_route IN ('direct', 'manual', 'system')),
  lease_until timestamptz NOT NULL,
  PRIMARY KEY (scope_id, instance_id)
);
CREATE INDEX IF NOT EXISTS network_route_instances_live_idx ON network_route_instances(scope_id, lease_until);

INSERT INTO network_route_targets(scope_id,target_version)
SELECT scope_id,settings_version FROM system_settings
ON CONFLICT (scope_id) DO NOTHING;
