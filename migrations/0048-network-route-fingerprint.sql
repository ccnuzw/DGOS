ALTER TABLE network_route_instances
  ADD COLUMN IF NOT EXISTS route_fingerprint text;

ALTER TABLE network_route_instances
  ADD CONSTRAINT network_route_fingerprint_format
  CHECK (route_fingerprint IS NULL OR route_fingerprint ~ '^[0-9a-f]{64}$');
