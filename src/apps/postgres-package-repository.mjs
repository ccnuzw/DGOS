import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';

const row = (r) => r && ({ packageId: r.package_id, appId: r.app_id, version: r.version, build: Number(r.build), releaseChannel: r.release_channel, manifest: r.manifest, digest: r.package_digest, source: r.source, keyId: r.key_id, requestId: r.request_id, trustLevel: r.effective_trust_level, uninstallPolicy: r.uninstall_policy, catalogState: r.catalog_state, reviewVersion: Number(r.review_version), reviewerId: r.reviewer_id, reviewReason: r.review_reason });
export class PostgresPackageRepository {
  constructor(pool) { this.pool = pool; this.context = new AsyncLocalStorage(); }
  query(sql, params) { return (this.context.getStore() ?? this.pool).query(sql, params); }
  async atomic(work) {
    const existing = this.context.getStore();
    if (existing) { await existing.query('BEGIN'); try { const result = await work(); await existing.query('COMMIT'); return result; } catch (error) { await existing.query('ROLLBACK'); throw error; } }
    const client = await this.pool.connect();
    try { return await this.context.run(client, async () => { await client.query('BEGIN'); try { const result = await work(); await client.query('COMMIT'); return result; } catch (error) { await client.query('ROLLBACK'); throw error; } }); }
    finally { client.release(); }
  }
  async withLock(subjectId, appId, work) {
    const client = await this.pool.connect();
    try {
      await client.query('SELECT pg_advisory_lock(hashtext($1),hashtext($2))', [String(subjectId), appId]);
      return await this.context.run(client, work);
    } catch (error) { throw error; }
    finally { try { await client.query('SELECT pg_advisory_unlock(hashtext($1),hashtext($2))', [String(subjectId), appId]); } finally { client.release(); } }
  }
  async withAppLock(appId, work) {
    const client = await this.pool.connect();
    try {
      await client.query('SELECT pg_advisory_lock(hashtext($1),hashtext($2))', ['package', appId]);
      return await this.context.run(client, work);
    } finally { try { await client.query('SELECT pg_advisory_unlock(hashtext($1),hashtext($2))', ['package', appId]); } finally { client.release(); } }
  }
  async auditEvent({ requestId, actorId, action, appId, digest, result = 'success' }) {
    const eventId = randomUUID();
    await this.query('INSERT INTO audit_events(event_id,request_id,actor_type,actor_id,action,target_type,target_id,result,summary) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', [eventId, requestId ?? randomUUID(), actorId ? 'admin' : 'system', actorId ?? null, action, 'app', null, result === 'success' ? 'succeeded' : result, JSON.stringify({ appId, digest })]);
    await this.query('INSERT INTO audit_outbox(event_id) VALUES($1)', [eventId]);
    return eventId;
  }
  async listRecoveryTargets() {
    let rows;
    try { ({ rows } = await this.query('SELECT subject_id,app_id FROM app_package_deployments UNION SELECT subject_id,app_id FROM app_package_operations WHERE state=$1 AND subject_id IS NOT NULL UNION SELECT subject_id,app_id FROM app_data_migrations WHERE state=$1', ['prepared'])); }
    catch (error) { if (error.code === '42P01') throw Object.assign(new Error('app_data_migration_schema_required'), { statusCode: 503, cause: error }); throw error; }
    return rows.map((item) => ({ subjectId: item.subject_id, appId: item.app_id }));
  }
  async markActionsSynced(subjectId, appId) { await this.query('UPDATE app_package_deployments SET actions_synced=true WHERE subject_id=$1 AND app_id=$2', [subjectId, appId]); }
  async recordMigration({ migrationId, subjectId, appId, requestId, fromVersion, toVersion, sourcePackageDigest, targetPackageDigest, beforeDigest, afterDigest }) { await this.query('INSERT INTO app_data_migrations(migration_id,subject_id,app_id,request_id,from_version,to_version,state,before_digest,after_digest,source_package_digest,target_package_digest) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [migrationId, subjectId, appId, requestId ?? null, fromVersion, toVersion, 'prepared', beforeDigest, afterDigest, sourcePackageDigest, targetPackageDigest]); }
  async finishMigration(migrationId, state, afterDigest) { await this.query('UPDATE app_data_migrations SET state=$2,after_digest=$3,finished_at=now() WHERE migration_id=$1', [migrationId, state, afterDigest ?? null]); }
  async listPendingMigrations(subjectId, appId) { const { rows } = await this.query("SELECT * FROM app_data_migrations WHERE subject_id=$1 AND app_id=$2 AND state='prepared'", [subjectId, appId]); return rows.map((item) => ({ migrationId: item.migration_id, subjectId, appId, fromVersion: Number(item.from_version), toVersion: Number(item.to_version), sourcePackageDigest: item.source_package_digest, targetPackageDigest: item.target_package_digest, beforeDigest: item.before_digest, afterDigest: item.after_digest })); }
  async getPackageById(packageId) { const { rows } = await this.query('SELECT * FROM app_package_releases WHERE package_id=$1', [packageId]); return row(rows[0]); }
  async recordPackage({ app, digest, source, keyId, requestId, effectiveTrustLevel, uninstallPolicy, catalogState }) {
    try {
      const { rows } = await this.query('INSERT INTO app_package_releases(package_id,app_id,version,build,release_channel,manifest,package_digest,source,key_id,request_id,effective_trust_level,uninstall_policy,catalog_state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *', [randomUUID(), app.appId, app.version, app.build, app.releaseChannel, JSON.stringify(app), digest, source, keyId, requestId, effectiveTrustLevel, uninstallPolicy, catalogState]);
      return row(rows[0]);
    } catch (error) { if (error.code === '23505') throw Object.assign(new Error('version_conflict'), { statusCode: 409 }); throw error; }
  }
  async removePackage(record) { await this.query('DELETE FROM app_package_releases WHERE package_id=$1', [record.packageId]); }
  async recordStageCandidate(app, digest) {
    const candidateId = randomUUID();
    await this.query("INSERT INTO app_package_stage_candidates(candidate_id,app_id,manifest,package_digest,state) VALUES($1,$2,$3,$4,'pending')", [candidateId, app.appId, JSON.stringify(app), digest]);
    return candidateId;
  }
  async setStageCandidateState(candidateId, state) {
    await this.query("UPDATE app_package_stage_candidates SET state=$2,terminal_at=CASE WHEN $2 IN ('failed','finalized') THEN now() ELSE terminal_at END WHERE candidate_id=$1", [candidateId, state]);
  }
  async findPackageByRequest(requestId) { const { rows } = await this.query('SELECT * FROM app_package_releases WHERE request_id=$1', [requestId]); return row(rows[0]); }
  async getPackage(appId, version, build, releaseChannel) { if (!releaseChannel) return null; const { rows } = await this.query('SELECT * FROM app_package_releases WHERE app_id=$1 AND release_channel=$2 AND ($3::text IS NULL OR version=$3) AND ($4::bigint IS NULL OR build=$4) ORDER BY created_at DESC LIMIT 1', [appId, releaseChannel, version ?? null, build ?? null]); return row(rows[0]); }
  async listPackages({ publicOnly = true } = {}) { const { rows } = await this.query(`SELECT * FROM app_package_releases ${publicOnly ? "WHERE catalog_state IN ('official','approved')" : ''} ORDER BY app_id,created_at DESC`); return rows.map(row); }
  async reviewPackage({ record, baseVersion, decision, actorId, requestId, reason }) {
    const { rows } = await this.query("UPDATE app_package_releases SET catalog_state=$2,review_version=review_version+1,reviewer_id=$3,review_request_id=$4,review_reason=$5 WHERE package_id=$1 AND review_version=$6 AND (catalog_state='pending_review' OR (catalog_state='approved' AND $2='withdrawn')) RETURNING *", [record.packageId, decision, actorId, requestId, reason ?? null, baseVersion]);
    if (!rows[0]) throw Object.assign(new Error('review_conflict'), { statusCode: 409 }); return row(rows[0]);
  }
  async getDeployment(subjectId, appId) { const { rows } = await this.query('SELECT * FROM app_package_deployments WHERE subject_id=$1 AND app_id=$2', [subjectId, appId]); return rows[0] ? { subjectId: rows[0].subject_id, appId, packageId: rows[0].package_id, version: rows[0].version, build: Number(rows[0].build), releaseChannel: rows[0].release_channel, digest: rows[0].package_digest, previousDigest: rows[0].previous_digest, state: rows[0].state, dataRetained: rows[0].data_retained, versionNumber: Number(rows[0].version_number), actionsSynced: rows[0].actions_synced } : null; }
  async restoreDeployment(subjectId, appId, previous) {
    if (!previous) { await this.query('DELETE FROM app_package_deployments WHERE subject_id=$1 AND app_id=$2', [subjectId, appId]); return; }
    await this.query('UPDATE app_package_deployments SET package_id=$3,version=$4,build=$5,release_channel=$6,package_digest=$7,previous_digest=$8,state=$9,data_retained=$10,version_number=$11,updated_at=now() WHERE subject_id=$1 AND app_id=$2', [subjectId, appId, previous.packageId, previous.version, previous.build, previous.releaseChannel, previous.digest, previous.previousDigest, previous.state, previous.dataRetained, previous.versionNumber]);
  }
  async saveDeployment({ subjectId, appId, release, requestId, previousDigest, expectedVersion, state, dataRetained = true }) {
    const values = [subjectId, appId, release.packageId, release.version, release.build, release.releaseChannel, release.digest, previousDigest ?? null, state, dataRetained, requestId ?? null];
    const { rows } = expectedVersion == null
      ? await this.query('INSERT INTO app_package_deployments(subject_id,app_id,package_id,version,build,release_channel,package_digest,previous_digest,state,data_retained,request_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(subject_id,app_id) DO NOTHING RETURNING *', values)
      : await this.query('UPDATE app_package_deployments SET package_id=$3,version=$4,build=$5,release_channel=$6,package_digest=$7,previous_digest=$8,state=$9,data_retained=$10,request_id=$11,version_number=version_number+1,updated_at=now() WHERE subject_id=$1 AND app_id=$2 AND version_number=$12 RETURNING *', [...values, expectedVersion]);
    if (!rows[0]) throw Object.assign(new Error('version_conflict'), { statusCode: 409 });
    return { subjectId, appId, version: rows[0].version, build: Number(rows[0].build), releaseChannel: rows[0].release_channel, digest: rows[0].package_digest, previousDigest: rows[0].previous_digest, state: rows[0].state, dataRetained: rows[0].data_retained, versionNumber: Number(rows[0].version_number) };
  }
  async recordOperation({ subjectId, appId, requestId, actorId, action, state, digest, reason }) { await this.query('INSERT INTO app_package_operations(operation_id,subject_id,app_id,request_id,actor_id,action,state,package_digest,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', [randomUUID(), subjectId ?? null, appId, requestId ?? null, actorId ?? null, action, state, digest ?? null, reason ?? null]); }
  async settlePrepared(subjectId, appId) {
    await this.query("UPDATE app_package_operations o SET state=CASE WHEN d.state='active' AND o.action='install' AND d.package_digest=o.package_digest THEN 'active' WHEN d.state='uninstalled' AND o.action='uninstall' THEN 'uninstalled' ELSE 'rolled_back' END, reason='reconciled_from_authoritative_deployment' FROM app_package_deployments d WHERE o.subject_id=$1 AND o.app_id=$2 AND o.state='prepared' AND d.subject_id=o.subject_id AND d.app_id=o.app_id", [subjectId, appId]);
    await this.query("UPDATE app_package_operations SET state='rolled_back',reason='reconciled_without_deployment' WHERE subject_id=$1 AND app_id=$2 AND state='prepared' AND NOT EXISTS(SELECT 1 FROM app_package_deployments d WHERE d.subject_id=$1 AND d.app_id=$2)", [subjectId, appId]);
  }
}
