-- Runtime action and permission identifiers are public text IDs, not UUIDs.
ALTER TABLE audit_events ALTER COLUMN target_id TYPE text USING target_id::text;
