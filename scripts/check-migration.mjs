import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const sql = await readFile(join(root, 'migrations/0001-v1-governance.sql'), 'utf8');
const leaseSql = await readFile(join(root, 'migrations/0002-connection-test-leases.sql'), 'utf8');
const outboxSql = await readFile(join(root, 'migrations/0003-audit-outbox-leases.sql'), 'utf8');
const retentionSql = await readFile(join(root, 'migrations/0004-retention-jobs.sql'), 'utf8');
const taskSql = await readFile(join(root, 'migrations/0007-provider-config-ai-task.sql'), 'utf8');
const quotaSql = await readFile(join(root, 'migrations/0005-quota-usage.sql'), 'utf8');
const quotaRepairSql = await readFile(join(root, 'migrations/0010-quota-usage-idempotency.sql'), 'utf8');
const quotaDimensionsSql = await readFile(join(root, 'migrations/0009-quota-usage-dimensions.sql'), 'utf8');
const runtimeSql = await readFile(join(root, 'migrations/0011-runtime-persistence.sql'), 'utf8');
const required = [
  'CREATE TABLE IF NOT EXISTS dgos_schema_migrations',
  'CREATE TABLE IF NOT EXISTS admin_principals',
  'CREATE TABLE IF NOT EXISTS admin_sessions',
  'CREATE TABLE IF NOT EXISTS api_key_records',
  'CREATE TABLE IF NOT EXISTS provider_accounts',
  'CREATE TABLE IF NOT EXISTS provider_bindings',
  'CREATE TABLE IF NOT EXISTS connection_tests',
  'CREATE TABLE IF NOT EXISTS audit_events',
  'CREATE TABLE IF NOT EXISTS quota_reservations',
  'CREATE TABLE IF NOT EXISTS usage_events',
  'CREATE TABLE IF NOT EXISTS audit_outbox',
  'UNIQUE (task_id, attempt_id, metric)',
];
const missing = required.filter((fragment) => !sql.includes(fragment));
const leaseRequired = ['ADD COLUMN IF NOT EXISTS lease_owner', 'ADD COLUMN IF NOT EXISTS lease_until', 'ADD COLUMN IF NOT EXISTS attempts', 'connection_tests_claim_idx'];
const missingLease = leaseRequired.filter((fragment) => !leaseSql.includes(fragment));
const outboxRequired = ['ADD COLUMN IF NOT EXISTS lease_owner', 'ADD COLUMN IF NOT EXISTS lease_until', 'audit_outbox_claim_idx'];
const missingOutbox = outboxRequired.filter((fragment) => !outboxSql.includes(fragment));
const retentionRequired = ['CREATE TABLE IF NOT EXISTS retention_jobs', 'preview_digest', 'checkpoint', 'retention_jobs_state_idx'];
const taskRequired = ['CREATE TABLE IF NOT EXISTS provider_configs', 'CREATE TABLE IF NOT EXISTS model_catalogs', 'CREATE TABLE IF NOT EXISTS model_policies', 'CREATE TABLE IF NOT EXISTS ai_tasks', 'CREATE TABLE IF NOT EXISTS ai_task_attempts', 'CREATE TABLE IF NOT EXISTS ai_task_events', 'CREATE TABLE IF NOT EXISTS artifacts', 'UNIQUE(owner_id,request_id)', 'UNIQUE(owner_id,request_id,input_digest)', 'UNIQUE(task_id,sequence)'];
const missingRetention = retentionRequired.filter((fragment) => !retentionSql.includes(fragment));
const missingTask = taskRequired.filter((fragment) => !taskSql.includes(fragment));
const quotaRequired = ['CREATE TABLE IF NOT EXISTS quota_policies', 'quota_policies_lookup_idx', 'request_id uuid', 'usage_status', 'task_id, attempt_id, metric', 'quota_reconciliation_checkpoints', 'quota_reconciliation_items'];
const quotaRepairRequired = ['DROP CONSTRAINT IF EXISTS usage_events_status_check', 'ADD CONSTRAINT usage_events_status_check'];
const quotaDimensionsRequired = ['ADD COLUMN IF NOT EXISTS input_tokens', 'ADD COLUMN IF NOT EXISTS output_tokens', 'ADD COLUMN IF NOT EXISTS total_tokens', 'ADD COLUMN IF NOT EXISTS estimated_cost'];
const missingQuota = quotaRequired.filter((fragment) => !quotaSql.includes(fragment));
const missingQuotaRepair = quotaRepairRequired.filter((fragment) => !quotaRepairSql.includes(fragment));
const missingQuotaDimensions = quotaDimensionsRequired.filter((fragment) => !quotaDimensionsSql.includes(fragment));
const runtimeRequired = ['permission_requests', 'action_definitions', 'action_plans', 'system_settings', 'system_setting_events', 'app_installs_request_id_uq'];
const missingRuntime = runtimeRequired.filter((fragment) => !runtimeSql.includes(fragment));
if (missing.length > 0 || missingLease.length > 0 || missingOutbox.length > 0 || missingRetention.length > 0 || missingTask.length > 0 || missingQuota.length > 0 || missingQuotaRepair.length > 0 || missingQuotaDimensions.length > 0 || missingRuntime.length > 0) {
  console.error(JSON.stringify({ ok: false, missing, missingLease, missingOutbox, missingRetention, missingTask, missingQuota, missingQuotaRepair, missingQuotaDimensions, missingRuntime }, null, 2));
  process.exit(1);
}
  console.log(JSON.stringify({ ok: true, migrations: ['0001-v1-governance.sql', '0002-connection-test-leases.sql', '0003-audit-outbox-leases.sql', '0004-retention-jobs.sql', '0005-quota-usage.sql', '0007-provider-config-ai-task.sql', '0009-quota-usage-dimensions.sql', '0010-quota-usage-idempotency.sql', '0011-runtime-persistence.sql'], requiredChecks: required.length + leaseRequired.length + outboxRequired.length + retentionRequired.length + quotaRequired.length + taskRequired.length + quotaRepairRequired.length + quotaDimensionsRequired.length + runtimeRequired.length }, null, 2));
