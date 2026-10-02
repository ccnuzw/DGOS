CREATE TABLE IF NOT EXISTS extension_runs (
  run_id uuid PRIMARY KEY, request_id uuid NOT NULL, subject_id uuid NOT NULL,
  app_id text NOT NULL, kind text NOT NULL CHECK (kind IN ('skill','mcp')),
  extension_id text NOT NULL, operation_id text NOT NULL,
  extension_version text NOT NULL, manifest_digest text NOT NULL,
  input_digest text NOT NULL, input_payload jsonb NOT NULL,
  state text NOT NULL CHECK (state IN ('queued','running','cancel_requested','succeeded','failed','timed_out','cancelled')),
  sequence bigint NOT NULL DEFAULT 1, handler_claimed boolean NOT NULL DEFAULT false,
  handler_calls integer NOT NULL DEFAULT 0 CHECK (handler_calls BETWEEN 0 AND 1),
  lease_owner text, lease_until timestamptz, timeout_at timestamptz NOT NULL,
  result_summary jsonb, reason_code text, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(subject_id, request_id)
);
CREATE INDEX IF NOT EXISTS extension_runs_queue_idx ON extension_runs(state, lease_until, created_at);
