CREATE TABLE IF NOT EXISTS network_proxy_provisioning (
  actor_id uuid NOT NULL,
  request_id uuid NOT NULL,
  secret_ref text NOT NULL UNIQUE CHECK (secret_ref ~ '^proxy_[A-Za-z0-9_-]{32,128}$'),
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
  hmac_version bigint NOT NULL CHECK (hmac_version > 0),
  display_name text NOT NULL,
  credential_status text NOT NULL CHECK (credential_status IN ('not_required', 'configured')),
  state text NOT NULL CHECK (state IN ('prepared', 'compensating', 'compensated', 'committed')),
  lease_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_id, request_id)
);
CREATE INDEX IF NOT EXISTS network_proxy_provisioning_recover_idx
  ON network_proxy_provisioning (lease_until) WHERE state IN ('prepared', 'compensating');
