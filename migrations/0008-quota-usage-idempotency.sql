ALTER TABLE usage_events DROP CONSTRAINT IF EXISTS usage_events_status_check;
ALTER TABLE usage_events ADD CONSTRAINT usage_events_status_check
  CHECK (usage_status IN ('pending', 'final', 'unavailable', 'estimated'));
