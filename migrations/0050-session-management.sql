ALTER TABLE admin_sessions ADD COLUMN session_management_id text;
UPDATE admin_sessions SET session_management_id = 'sm_' || replace(gen_random_uuid()::text, '-', '') WHERE session_management_id IS NULL;
ALTER TABLE admin_sessions ALTER COLUMN session_management_id SET NOT NULL;
ALTER TABLE admin_sessions ALTER COLUMN session_management_id SET DEFAULT ('sm_' || replace(gen_random_uuid()::text, '-', ''));
ALTER TABLE admin_sessions ADD CONSTRAINT admin_session_management_id_format CHECK (session_management_id ~ '^sm_[A-Za-z0-9_-]{32,128}$');
CREATE UNIQUE INDEX admin_sessions_management_id_idx ON admin_sessions (session_management_id);

CREATE TABLE admin_session_revoke_receipts (
  principal_id uuid NOT NULL REFERENCES admin_principals(principal_id),
  request_id uuid NOT NULL,
  session_management_id text NOT NULL,
  revoked_at timestamptz NOT NULL,
  session_version bigint NOT NULL,
  PRIMARY KEY (principal_id, request_id)
);
