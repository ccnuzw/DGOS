ALTER TABLE action_runs ADD COLUMN IF NOT EXISTS handler_claimed boolean NOT NULL DEFAULT false;
