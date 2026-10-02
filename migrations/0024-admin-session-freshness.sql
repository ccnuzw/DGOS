ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS auth_fresh_until timestamptz;
CREATE INDEX IF NOT EXISTS admin_sessions_revoked_retention_idx ON admin_sessions (revoked_at) WHERE state = 'revoked';
