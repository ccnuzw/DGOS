CREATE TABLE app_package_stage_candidates (
  candidate_id uuid PRIMARY KEY,
  app_id text NOT NULL,
  manifest jsonb NOT NULL,
  package_digest text NOT NULL CHECK (package_digest ~ '^sha256:[0-9a-f]{64}$'),
  state text NOT NULL CHECK (state IN ('pending','staged','finalized','failed','cleaning','cleaned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  terminal_at timestamptz,
  cleanup_job_id uuid REFERENCES retention_jobs(job_id),
  retry_count integer NOT NULL DEFAULT 0,
  last_error text,
  CHECK (state IN ('pending','staged') OR terminal_at IS NOT NULL)
);
CREATE INDEX app_package_stage_retention_idx ON app_package_stage_candidates(state,terminal_at,created_at);

CREATE TABLE app_package_cleanup_intents (
  intent_id uuid PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES retention_jobs(job_id),
  category text NOT NULL CHECK (category IN ('failed_install','staged_package')),
  item_id uuid NOT NULL,
  state text NOT NULL CHECK (state IN ('prepared','removed','skipped','failed')),
  reason text,
  attempts integer NOT NULL DEFAULT 0,
  counted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(category,item_id)
);
CREATE INDEX app_package_cleanup_retry_idx ON app_package_cleanup_intents(state,updated_at);
