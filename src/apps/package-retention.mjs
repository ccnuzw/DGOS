import { createHash, randomUUID } from 'node:crypto';

const DAY_MS = 86400000;
const protectedSql = `
  EXISTS (SELECT 1 FROM app_package_releases r WHERE r.app_id=c.app_id AND r.package_digest=c.package_digest)
  OR EXISTS (SELECT 1 FROM app_package_deployments d WHERE d.app_id=c.app_id AND (d.package_digest=c.package_digest OR d.previous_digest=c.package_digest))
  OR EXISTS (SELECT 1 FROM app_package_operations o WHERE o.app_id=c.app_id AND o.package_digest=c.package_digest AND o.state='prepared')
  OR EXISTS (SELECT 1 FROM app_data_migrations m WHERE m.app_id=c.app_id AND m.state='prepared' AND (m.source_package_digest=c.package_digest OR m.target_package_digest=c.package_digest))
  OR EXISTS (SELECT 1 FROM app_package_stage_candidates other WHERE other.app_id=c.app_id AND other.package_digest=c.package_digest AND other.candidate_id<>c.candidate_id AND other.state IN ('pending','staged','finalized'))`;
const failedInstallProtected = `
  o.request_id IS NULL
  OR EXISTS (SELECT 1 FROM app_package_deployments d WHERE d.app_id=o.app_id AND (d.package_digest=o.package_digest OR d.previous_digest=o.package_digest))
  OR EXISTS (SELECT 1 FROM app_data_migrations m WHERE m.app_id=o.app_id AND m.state='prepared' AND (m.source_package_digest=o.package_digest OR m.target_package_digest=o.package_digest))
  OR EXISTS (SELECT 1 FROM app_package_operations active WHERE active.app_id=o.app_id AND active.package_digest=o.package_digest AND active.state='prepared')
  OR EXISTS (SELECT 1 FROM audit_events e JOIN audit_outbox b ON b.event_id=e.event_id WHERE e.request_id=o.request_id AND b.published_at IS NULL)`;

export class PostgresPackageRetention {
  constructor({ pool, store, audit, clock = () => Date.now() }) { Object.assign(this, { pool, store, audit, clock }); }
  cutoff(policy) { return new Date(Math.floor(this.clock() / 60000) * 60000 - policy.cacheRetentionDays * DAY_MS); }
  async recoverPending() {
    const { rows } = await this.pool.query("SELECT candidate_id,app_id,package_digest FROM app_package_stage_candidates WHERE state IN ('pending','staged') ORDER BY created_at,candidate_id");
    for (const item of rows) await this.withAppLock(item.app_id, async (client) => {
      const fresh = (await client.query("SELECT state FROM app_package_stage_candidates WHERE candidate_id=$1", [item.candidate_id])).rows[0];
      if (!fresh || !['pending', 'staged'].includes(fresh.state)) return;
      const registered = await client.query('SELECT 1 FROM app_package_releases WHERE app_id=$1 AND package_digest=$2 LIMIT 1', [item.app_id, item.package_digest]);
      await client.query("UPDATE app_package_stage_candidates SET state=$2,terminal_at=now() WHERE candidate_id=$1", [item.candidate_id, registered.rowCount ? 'finalized' : 'failed']);
    });
  }
  async ready() { await this.recoverPending(); return this; }
  async preview(policy) {
    const cutoff = this.cutoff(policy);
    const { rows } = await this.pool.query(`SELECT candidate_id, package_digest, count(*) FILTER (WHERE NOT (${protectedSql}))::int eligible, count(*) FILTER (WHERE ${protectedSql})::int protected FROM app_package_stage_candidates c WHERE c.state='failed' AND c.terminal_at<$1 GROUP BY candidate_id, package_digest ORDER BY candidate_id`, [cutoff]);
    const failed = await this.pool.query(`SELECT operation_id, package_digest, count(*) FILTER (WHERE NOT (${failedInstallProtected}))::int eligible, count(*) FILTER (WHERE ${failedInstallProtected})::int protected FROM app_package_operations o WHERE o.action='install' AND o.state IN ('rolled_back','rejected') AND o.occurred_at<$1 GROUP BY operation_id, package_digest ORDER BY operation_id`, [cutoff]);
    const plan = JSON.stringify({ cutoffAt: cutoff.toISOString(), staged: rows.map((row) => [row.candidate_id, row.package_digest, row.protected]), failedInstall: failed.rows.map((row) => [row.operation_id, row.package_digest, row.protected]) });
    return {
      plan: {
        cutoffAt: cutoff.toISOString(),
        policyVersion: String(policy.policyVersion ?? policy.version),
        categories: ['failedInstall', 'stagedPackage'],
        itemDigest: createHash('sha256').update(plan).digest('hex'),
      },
      failedInstall: { eligibleCount: failed.rows.reduce((sum, row) => sum + row.eligible, 0), protectedCount: failed.rows.reduce((sum, row) => sum + row.protected, 0) },
      stagedPackage: { eligibleCount: rows.reduce((sum, row) => sum + row.eligible, 0), protectedCount: rows.reduce((sum, row) => sum + row.protected, 0) },
    };
  }
  async withAppLock(appId, work) {
    const client = await this.pool.connect();
    try { await client.query('SELECT pg_advisory_lock(hashtext($1),hashtext($2))', ['package', appId]); return await work(client); }
    finally { try { await client.query('SELECT pg_advisory_unlock(hashtext($1),hashtext($2))', ['package', appId]); } finally { client.release(); } }
  }
  async record(client, job, category, itemId, state, reason) {
    await client.query('BEGIN');
    try {
      const priorRow = (await client.query('SELECT state,counted,job_id FROM app_package_cleanup_intents WHERE category=$1 AND item_id=$2 FOR UPDATE', [category, itemId])).rows[0];
      const prior = priorRow?.job_id === job.job_id ? priorRow : null;
      if (state === 'prepared' && prior?.counted) { await client.query('COMMIT'); return; }
      const { rows } = await client.query(`INSERT INTO app_package_cleanup_intents(intent_id,job_id,category,item_id,state,reason,attempts) VALUES($1,$2,$3,$4,$5,$6,1) ON CONFLICT(category,item_id) DO UPDATE SET job_id=$2,state=$5,reason=$6,counted=CASE WHEN app_package_cleanup_intents.job_id=$2 THEN app_package_cleanup_intents.counted ELSE false END,attempts=app_package_cleanup_intents.attempts+1,updated_at=now() RETURNING intent_id`, [randomUUID(), job.job_id, category, itemId, state, reason ?? null]);
      await this.audit.record({ requestId: job.request_id ?? randomUUID(), actorId: job.actor_id, action: `governance.retention.package.${state}`, targetType: 'retention_job', targetId: job.job_id, summary: { state, reasonCode: reason ?? category } }, client);
      if (state !== 'prepared' && prior?.state !== state) {
        await client.query('UPDATE app_package_cleanup_intents SET counted=true WHERE intent_id=$1', [rows[0].intent_id]);
        const column = (value) => value === 'removed' ? 'deleted_count' : value === 'skipped' ? 'skipped_count' : 'failure_count';
        if (prior?.counted && prior.state !== 'prepared') await client.query(`UPDATE retention_jobs SET ${column(prior.state)}=${column(prior.state)}-1 WHERE job_id=$1`, [job.job_id]);
        await client.query(`UPDATE retention_jobs SET scanned_count=scanned_count+$2,${column(state)}=${column(state)}+1,updated_at=now() WHERE job_id=$1`, [job.job_id, prior?.counted ? 0 : 1]);
      }
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
  }
  async runBatch(job, policy, batchSize = 100) {
    const cutoff = this.cutoff(policy);
    const stages = await this.pool.query("SELECT * FROM app_package_stage_candidates c WHERE (state='failed' AND terminal_at<$1 OR state='cleaning') AND NOT EXISTS (SELECT 1 FROM app_package_cleanup_intents i WHERE i.category='staged_package' AND i.item_id=c.candidate_id AND i.job_id=$3 AND i.state='skipped') ORDER BY terminal_at NULLS FIRST,candidate_id LIMIT $2", [cutoff, batchSize, job.job_id]);
    const operations = await this.pool.query("SELECT * FROM app_package_operations o WHERE action='install' AND state IN ('rolled_back','rejected') AND occurred_at<$1 AND NOT EXISTS (SELECT 1 FROM app_package_cleanup_intents i WHERE i.category='failed_install' AND i.item_id=o.operation_id AND i.job_id=$3 AND i.state IN ('removed','skipped')) ORDER BY occurred_at,operation_id LIMIT $2", [cutoff, Math.max(0, batchSize - stages.rowCount), job.job_id]);
    for (const item of stages.rows) await this.withAppLock(item.app_id, async (client) => {
      const fresh = (await client.query('SELECT * FROM app_package_stage_candidates WHERE candidate_id=$1', [item.candidate_id])).rows[0];
      if (!fresh || !['failed','cleaning'].includes(fresh.state)) return;
      const references = await client.query(`SELECT (${protectedSql}) AS protected FROM app_package_stage_candidates c WHERE c.candidate_id=$1`, [fresh.candidate_id]);
      if (references.rows[0].protected) { await this.record(client, job, 'staged_package', fresh.candidate_id, 'skipped', 'package_referenced'); return; }
      const intent = (await client.query("SELECT state FROM app_package_cleanup_intents WHERE category='staged_package' AND item_id=$1", [fresh.candidate_id])).rows[0];
      if (fresh.state === 'cleaning' && intent?.state === 'removed') {
        await client.query("UPDATE app_package_stage_candidates SET state='cleaned' WHERE candidate_id=$1", [fresh.candidate_id]);
        return;
      }
      if (fresh.state === 'failed') {
        await this.record(client, job, 'staged_package', fresh.candidate_id, 'prepared');
        await client.query("UPDATE app_package_stage_candidates SET state='cleaning',cleanup_job_id=$2 WHERE candidate_id=$1", [fresh.candidate_id, job.job_id]);
      }
      let diskError;
      try { await this.store.removeStagedCandidate(fresh.manifest, fresh.package_digest, fresh.candidate_id); }
      catch (error) { diskError = error; }
      if (diskError) {
        await this.record(client, job, 'staged_package', fresh.candidate_id, 'failed', 'disk_cleanup_failed');
        await client.query('UPDATE app_package_stage_candidates SET retry_count=retry_count+1,last_error=$2 WHERE candidate_id=$1', [fresh.candidate_id, diskError.message.slice(0,128)]);
      } else {
        await this.record(client, job, 'staged_package', fresh.candidate_id, 'removed');
        await client.query("UPDATE app_package_stage_candidates SET state='cleaned',terminal_at=coalesce(terminal_at,now()) WHERE candidate_id=$1", [fresh.candidate_id]);
      }
    });
    for (const item of operations.rows) await this.withAppLock(item.app_id, async (client) => {
      const fresh = (await client.query("SELECT * FROM app_package_operations WHERE operation_id=$1 AND state IN ('rolled_back','rejected') AND occurred_at<$2", [item.operation_id, cutoff])).rows[0];
      if (!fresh) return;
      const refs = await client.query(`SELECT (${failedInstallProtected}) AS protected FROM app_package_operations o WHERE o.operation_id=$1`, [fresh.operation_id]);
      if (refs.rows[0].protected) { await this.record(client, job, 'failed_install', fresh.operation_id, 'skipped', 'package_referenced'); return; }
      await client.query('BEGIN');
      try {
        await client.query('DELETE FROM app_package_operations WHERE operation_id=$1', [fresh.operation_id]);
        await this.recordInTransaction(client, job, 'failed_install', fresh.operation_id, 'removed');
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; }
    });
    const pending = await this.pool.query("SELECT 1 FROM app_package_stage_candidates c WHERE (c.state='failed' AND c.terminal_at<$1 OR c.state='cleaning') AND NOT EXISTS (SELECT 1 FROM app_package_cleanup_intents i WHERE i.category='staged_package' AND i.item_id=c.candidate_id AND i.job_id=$2 AND i.state='skipped') LIMIT 1", [cutoff, job.job_id]);
    const moreOperations = await this.pool.query("SELECT 1 FROM app_package_operations o WHERE o.action='install' AND o.state IN ('rolled_back','rejected') AND o.occurred_at<$1 AND NOT EXISTS (SELECT 1 FROM app_package_cleanup_intents i WHERE i.category='failed_install' AND i.item_id=o.operation_id AND i.job_id=$2 AND i.state IN ('removed','skipped')) LIMIT 1", [cutoff, job.job_id]);
    const failed = await this.pool.query("SELECT 1 FROM app_package_cleanup_intents WHERE job_id=$1 AND state='failed' LIMIT 1", [job.job_id]);
    return { processed: stages.rowCount + operations.rowCount, full: Boolean(pending.rowCount || moreOperations.rowCount) && (stages.rowCount + operations.rowCount >= batchSize), failed: Boolean(failed.rowCount) };
  }
  async recordInTransaction(client, job, category, itemId, state) {
    const { rows } = await client.query("INSERT INTO app_package_cleanup_intents(intent_id,job_id,category,item_id,state,attempts,counted) VALUES($1,$2,$3,$4,$5,1,true) ON CONFLICT(category,item_id) DO UPDATE SET job_id=$2,state=$5,counted=true RETURNING intent_id", [randomUUID(), job.job_id, category, itemId, state]);
    await this.audit.record({ requestId: job.request_id ?? randomUUID(), actorId: job.actor_id, action: 'governance.retention.package.removed', targetType: 'retention_job', targetId: job.job_id, summary: { state, reasonCode: category } }, client);
    await client.query('UPDATE retention_jobs SET scanned_count=scanned_count+1,deleted_count=deleted_count+1,updated_at=now() WHERE job_id=$1', [job.job_id]);
    return rows[0];
  }
}
