ALTER TABLE api_key_records ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES admin_principals(principal_id);
ALTER TABLE api_key_records ADD COLUMN IF NOT EXISTS rotation_until timestamptz;
ALTER TABLE api_key_records ADD COLUMN IF NOT EXISTS rotated_to uuid REFERENCES api_key_records(key_id);
ALTER TABLE api_key_records DROP CONSTRAINT IF EXISTS api_key_records_state_check;
ALTER TABLE api_key_records ADD CONSTRAINT api_key_records_state_check CHECK (state IN ('active', 'rotation_pending', 'expired', 'revoked'));
CREATE INDEX IF NOT EXISTS api_key_rotation_due_idx ON api_key_records (rotation_until) WHERE state = 'rotation_pending';
