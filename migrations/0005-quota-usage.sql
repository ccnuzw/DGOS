-- Quota policy, idempotent reservations, usage facts, and recoverable reconciliation.
CREATE TABLE IF NOT EXISTS quota_policies (
  policy_id uuid PRIMARY KEY,
  scope_type text NOT NULL CHECK (scope_type IN ('subject', 'provider_account', 'provider_config', 'model', 'deployment')),
  scope_id text NOT NULL,
  metric text NOT NULL,
  window_seconds integer NOT NULL CHECK (window_seconds > 0),
  hard_limit numeric(20, 6) CHECK (hard_limit IS NULL OR hard_limit >= 0),
  soft_limit numeric(20, 6) CHECK (soft_limit IS NULL OR soft_limit >= 0),
  version bigint NOT NULL CHECK (version > 0),
  effective_at timestamptz NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope_type, scope_id, metric, version),
  CHECK (soft_limit IS NULL OR hard_limit IS NULL OR soft_limit <= hard_limit)
);
CREATE INDEX IF NOT EXISTS quota_policies_lookup_idx
  ON quota_policies (scope_type, scope_id, metric, effective_at DESC, version DESC);

ALTER TABLE quota_reservations ADD COLUMN IF NOT EXISTS request_id uuid;
ALTER TABLE quota_reservations ADD COLUMN IF NOT EXISTS subject_id uuid;
ALTER TABLE quota_reservations ADD COLUMN IF NOT EXISTS provider_account_id uuid;
ALTER TABLE quota_reservations ADD COLUMN IF NOT EXISTS provider_config_id uuid;
ALTER TABLE quota_reservations ADD COLUMN IF NOT EXISTS model_ref text;
ALTER TABLE quota_reservations ADD COLUMN IF NOT EXISTS window_start timestamptz;
ALTER TABLE quota_reservations ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE quota_reservations DROP CONSTRAINT IF EXISTS quota_reservations_state_check;
ALTER TABLE quota_reservations ADD CONSTRAINT quota_reservations_state_check
  CHECK (state IN ('reserved', 'settled', 'released', 'expired', 'needs_review'));
CREATE UNIQUE INDEX IF NOT EXISTS quota_reservations_request_scope_idx
  ON quota_reservations (request_id, scope_type, scope_id, task_id, attempt_id, metric)
  WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS quota_reservations_active_window_idx
  ON quota_reservations (scope_type, scope_id, metric, window_start, state, expires_at);

ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS request_id uuid;
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS subject_id uuid;
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS provider_account_id uuid;
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS provider_config_id uuid;
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS model_ref text;
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS operation text;
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS usage_status text NOT NULL DEFAULT 'final';
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS estimated boolean NOT NULL DEFAULT false;
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'count';
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS source_digest text;
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS occurred_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS reservation_id uuid REFERENCES quota_reservations(reservation_id);
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS window_start timestamptz;
ALTER TABLE usage_events ADD CONSTRAINT usage_events_status_check
  CHECK (usage_status IN ('pending', 'final', 'unavailable', 'estimated'));
CREATE INDEX IF NOT EXISTS usage_events_subject_time_idx ON usage_events (subject_id, occurred_at DESC, usage_event_id);
CREATE INDEX IF NOT EXISTS usage_events_scope_window_idx ON usage_events (metric, window_start, subject_id);

CREATE TABLE IF NOT EXISTS quota_reconciliation_checkpoints (
  checkpoint_name text PRIMARY KEY,
  cursor_created_at timestamptz,
  cursor_id uuid,
  state text NOT NULL CHECK (state IN ('idle', 'running', 'failed', 'completed')),
  scanned_count bigint NOT NULL DEFAULT 0 CHECK (scanned_count >= 0),
  repaired_count bigint NOT NULL DEFAULT 0 CHECK (repaired_count >= 0),
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS quota_reconciliation_items (
  item_id uuid PRIMARY KEY,
  reservation_id uuid REFERENCES quota_reservations(reservation_id),
  task_id uuid NOT NULL,
  attempt_id uuid NOT NULL,
  metric text NOT NULL,
  reason text NOT NULL CHECK (reason IN ('expired_reservation', 'missing_settlement', 'duplicate_usage')),
  state text NOT NULL CHECK (state IN ('pending', 'resolved', 'failed', 'needs_review')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reservation_id, reason)
);
CREATE INDEX IF NOT EXISTS quota_reconciliation_pending_idx
  ON quota_reconciliation_items (state, created_at, item_id);
