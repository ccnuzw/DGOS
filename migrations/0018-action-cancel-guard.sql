UPDATE action_runs SET state = 'failed', error_summary = 'cancel_outcome_unknown'
WHERE state = 'cancel_requested' AND handler_claimed = true AND lease_until < now();
