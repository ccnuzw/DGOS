-- Legacy claimed runs have no replayable input. Mark them for reconciliation, never dispatch them again.
UPDATE action_runs SET state = 'failed', error_summary = 'outcome_unknown'
WHERE state = 'running' AND handler_claimed = true AND lease_until < now();
