ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS input_tokens numeric(20, 6);
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS output_tokens numeric(20, 6);
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS total_tokens numeric(20, 6);
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS estimated_cost numeric(20, 8);
ALTER TABLE usage_events ADD CONSTRAINT usage_events_token_values_check
  CHECK (input_tokens IS NULL OR input_tokens >= 0)
  NOT VALID;
ALTER TABLE usage_events ADD CONSTRAINT usage_events_output_token_values_check
  CHECK (output_tokens IS NULL OR output_tokens >= 0)
  NOT VALID;
ALTER TABLE usage_events ADD CONSTRAINT usage_events_total_token_values_check
  CHECK (total_tokens IS NULL OR total_tokens >= 0)
  NOT VALID;
ALTER TABLE usage_events ADD CONSTRAINT usage_events_estimated_cost_check
  CHECK (estimated_cost IS NULL OR estimated_cost >= 0)
  NOT VALID;
