ALTER TABLE app_data_migrations
  ADD COLUMN source_package_digest text,
  ADD COLUMN target_package_digest text;

UPDATE app_data_migrations
SET state = 'rolled_back', finished_at = now()
WHERE state = 'prepared';

ALTER TABLE app_data_migrations
  ADD CONSTRAINT app_data_migrations_prepared_package_digests
  CHECK (state <> 'prepared' OR (source_package_digest IS NOT NULL AND target_package_digest IS NOT NULL));
