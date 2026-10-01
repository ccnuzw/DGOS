-- Audit retention jobs and checkpoint state. Expand-only.
CREATE TABLE IF NOT EXISTS retention_jobs (
  job_id uuid PRIMARY KEY,
  preview_digest text NOT NULL,
  state text NOT NULL CHECK (state IN ('planned', 'running', 'completed', 'partial', 'failed')),
  checkpoint text,
  cutoff_at timestamptz NOT NULL,
  scanned_count integer NOT NULL DEFAULT 0 CHECK (scanned_count >= 0),
  deleted_count integer NOT NULL DEFAULT 0 CHECK (deleted_count >= 0),
  skipped_count integer NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS retention_jobs_state_idx ON retention_jobs (state, updated_at);
