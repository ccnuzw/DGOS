CREATE TABLE IF NOT EXISTS extension_run_events (
  run_id uuid NOT NULL REFERENCES extension_runs(run_id), sequence bigint NOT NULL,
  state text NOT NULL, reason_code text, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(run_id, sequence)
);
CREATE INDEX IF NOT EXISTS extension_run_events_created_idx ON extension_run_events(created_at);
