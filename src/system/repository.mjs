import { randomUUID } from 'node:crypto';

const networkRoles = ['api', 'worker'];
const affectedServices = ['provider', 'model-catalog', 'ai-task', 'mcp-http', 'online-import'];
function networkProjection(settings, targetVersion, instances) {
  const network = settings.network ?? {};
  const active = instances.filter((item) => item.leaseUntil > Date.now());
  const rolesReady = networkRoles.every((role) => active.some((item) => item.role === role));
  const current = rolesReady && Boolean(active[0]?.fingerprint) && active.every((item) => String(item.version) === String(targetVersion) && item.route === active[0].route && item.fingerprint === active[0].fingerprint);
  return { ...network, effectiveRoute: current ? active[0].route : 'unavailable', restartRequired: !current, affectedServices };
}
const changedNetwork = (before, after) => before.effectiveRoute !== after.effectiveRoute || before.restartRequired !== after.restartRequired;

export class InMemorySystemRepository {
  constructor() { this.settings = null; this.events = []; this.committing = false; this.networkInstances = new Map(); this.networkTargetVersion = '1'; }
  async ensure(_scopeId, settings) { this.settings ??= { settingsVersion: '1', contextVersion: '1', settings: structuredClone(settings) }; }
  async load() { if (!this.settings) return null; this.reconcileNetwork(); const loaded = structuredClone(this.settings); loaded.networkVersion = this.networkTargetVersion; return loaded; }
  async save(_scopeId, value, event, auditEvent, audit, { permissionBatch = false } = {}) {
    if (this.committing || this.permissionRuleCommitting && !permissionBatch || String(value.settingsVersion) !== String(this.settings?.settingsVersion)) throw Object.assign(new Error('version_conflict'), { statusCode: 409 });
    if (!audit?.record) throw Object.assign(new Error('audit_unavailable'), { statusCode: 503 });
    this.committing = true;
    const next = { settingsVersion: String(Number(this.settings.settingsVersion) + 1), contextVersion: String(Number(this.settings.contextVersion) + 1), settings: structuredClone(value.settings) };
    try {
      await audit.record(auditEvent);
      this.settings = next; if (event.domain === 'network') this.networkTargetVersion = next.settingsVersion; this.events.push({ ...event, contextVersion: next.contextVersion });
      return structuredClone(next);
    } finally { this.committing = false; }
  }
  async eventsAfter(_scopeId, version) { this.reconcileNetwork(); return this.events.filter((event) => Number(event.contextVersion) > Number(version)); }
  reconcileNetwork() {
    if (!this.settings) return;
    const after = networkProjection(this.settings.settings, this.networkTargetVersion, [...this.networkInstances.values()]);
    if (!changedNetwork(this.settings.settings.network, after)) return;
    this.settings.settings.network = after;
    this.settings.contextVersion = String(Number(this.settings.contextVersion) + 1);
    this.events.push({ contextVersion: this.settings.contextVersion, domain: 'network', restartRequired: after.restartRequired });
  }
  async recordNetworkActivation(_scopeId, { instanceId, role, settingsVersion, effectiveRoute, routeFingerprint, leaseMs = 15_000 }) {
    this.networkInstances.set(instanceId, { role, version: settingsVersion, route: effectiveRoute, fingerprint: routeFingerprint, leaseUntil: Date.now() + leaseMs });
    this.reconcileNetwork();
  }
  async releaseNetworkActivation(_scopeId, instanceId) {
    this.networkInstances.delete(instanceId);
    this.reconcileNetwork();
  }
}

export class PostgresSystemRepository {
  constructor(pool) { this.pool = pool; }
  async ensure(scopeId, settings) { await this.pool.query('INSERT INTO system_settings(scope_id,settings) VALUES($1,$2) ON CONFLICT(scope_id) DO NOTHING', [scopeId, JSON.stringify(settings)]); await this.pool.query('INSERT INTO network_route_targets(scope_id,target_version) SELECT scope_id,settings_version FROM system_settings WHERE scope_id=$1 ON CONFLICT(scope_id) DO NOTHING', [scopeId]); }
  async load(scopeId) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query('SELECT * FROM system_settings WHERE scope_id=$1 FOR UPDATE', [scopeId]);
      if (!rows[0]) { await client.query('COMMIT'); return null; }
      const row = rows[0];
      const network = await this.reconcileNetwork(client, scopeId, row.settings);
      const { rows: versions } = await client.query('SELECT context_version FROM system_settings WHERE scope_id=$1', [scopeId]);
      await client.query('COMMIT');
      return { settingsVersion: String(row.settings_version), contextVersion: String(versions[0].context_version), networkVersion: String(network.version), settings: { ...row.settings, network: network.projection } };
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  async save(scopeId, value, event, auditEvent, audit) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query('UPDATE system_settings SET settings=$2,settings_version=settings_version+1,context_version=context_version+1,updated_at=now() WHERE scope_id=$1 AND settings_version=$3 RETURNING settings_version,context_version', [scopeId, JSON.stringify(value.settings), Number(value.settingsVersion)]);
      if (!rows[0]) throw Object.assign(new Error('version_conflict'), { statusCode: 409 });
      await client.query('INSERT INTO system_setting_events(event_id,scope_id,context_version,domain,restart_required) VALUES($1,$2,$3,$4,$5)', [event.eventId, scopeId, rows[0].context_version, event.domain, event.restartRequired]);
      if (event.domain === 'network') await client.query('UPDATE network_route_targets SET target_version=$2,updated_at=now() WHERE scope_id=$1', [scopeId, rows[0].settings_version]);
      await this.recordAudit(client, auditEvent);
      await client.query('COMMIT');
      return { settingsVersion: String(rows[0].settings_version), contextVersion: String(rows[0].context_version) };
    } catch (cause) { await client.query('ROLLBACK'); throw cause; }
    finally { client.release(); }
  }
  async recordAudit(client, auditEvent) {
    const eventId = randomUUID();
    await client.query('INSERT INTO audit_events(event_id,request_id,actor_type,actor_id,action,target_type,target_id,result,summary) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', [eventId, auditEvent.requestId, auditEvent.actorId ? 'admin' : 'system', auditEvent.actorId ?? null, auditEvent.action, auditEvent.targetType, null, 'succeeded', JSON.stringify(auditEvent.summary)]);
    await client.query('INSERT INTO audit_outbox(event_id) VALUES($1)', [eventId]);
  }
  async eventsAfter(scopeId, version) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: locked } = await client.query('SELECT settings FROM system_settings WHERE scope_id=$1 FOR UPDATE', [scopeId]);
      if (locked[0]) await this.reconcileNetwork(client, scopeId, locked[0].settings);
      const { rows } = await client.query('SELECT context_version,domain,restart_required,created_at FROM system_setting_events WHERE scope_id=$1 AND context_version>$2 ORDER BY context_version', [scopeId, Number(version)]);
      await client.query('COMMIT');
      return rows.map((row) => ({ contextVersion: String(row.context_version), domain: row.domain, restartRequired: row.restart_required, createdAt: row.created_at.toISOString() }));
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  async recordNetworkActivation(scopeId, { instanceId, role, settingsVersion, effectiveRoute, routeFingerprint, leaseMs = 15_000 }) {
    if (!networkRoles.includes(role) || !Number.isSafeInteger(leaseMs) || leaseMs < 1000 || leaseMs > 60_000) throw new Error('network_activation_invalid');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const locked = await client.query('SELECT settings FROM system_settings WHERE scope_id=$1 FOR UPDATE', [scopeId]);
      if (!locked.rows[0]) throw new Error('network_activation_invalid');
      await client.query(`INSERT INTO network_route_instances(scope_id,instance_id,service_role,settings_version,effective_route,route_fingerprint,lease_until)
      VALUES($1,$2,$3,$4,$5,$6,now()+($7::int * interval '1 millisecond'))
      ON CONFLICT(scope_id,instance_id) DO UPDATE SET service_role=EXCLUDED.service_role,settings_version=EXCLUDED.settings_version,effective_route=EXCLUDED.effective_route,route_fingerprint=EXCLUDED.route_fingerprint,lease_until=EXCLUDED.lease_until`, [scopeId, instanceId, role, settingsVersion, effectiveRoute, routeFingerprint, leaseMs]);
      await this.reconcileNetwork(client, scopeId, locked.rows[0].settings);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  async releaseNetworkActivation(scopeId, instanceId) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const locked = await client.query('SELECT settings FROM system_settings WHERE scope_id=$1 FOR UPDATE', [scopeId]);
      if (locked.rows[0]) {
        await client.query('DELETE FROM network_route_instances WHERE scope_id=$1 AND instance_id=$2', [scopeId, instanceId]);
        await this.reconcileNetwork(client, scopeId, locked.rows[0].settings);
      }
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  async networkState(client, scopeId, settings) {
    const { rows } = await client.query(`SELECT t.target_version,i.service_role,i.settings_version,i.effective_route,i.route_fingerprint,i.lease_until
      FROM network_route_targets t LEFT JOIN network_route_instances i ON i.scope_id=t.scope_id AND i.lease_until>now()
      WHERE t.scope_id=$1`, [scopeId]);
    return { version: rows[0]?.target_version, projection: networkProjection(settings, rows[0]?.target_version, rows.filter((row) => row.service_role).map((row) => ({ role: row.service_role, version: row.settings_version, route: row.effective_route, fingerprint: row.route_fingerprint, leaseUntil: Date.parse(row.lease_until) }))) };
  }
  async reconcileNetwork(client, scopeId, settings) {
    const state = await this.networkState(client, scopeId, settings);
    if (!changedNetwork(settings.network ?? {}, state.projection)) return state;
    const { rows } = await client.query(`UPDATE system_settings SET settings=jsonb_set(settings,'{network}',$2::jsonb),context_version=context_version+1,updated_at=now()
      WHERE scope_id=$1 RETURNING context_version`, [scopeId, JSON.stringify(state.projection)]);
    settings.network = state.projection;
    await client.query('INSERT INTO system_setting_events(event_id,scope_id,context_version,domain,restart_required) VALUES($1,$2,$3,$4,$5)', [randomUUID(), scopeId, rows[0].context_version, 'network', state.projection.restartRequired]);
    await this.recordAudit(client, { requestId: randomUUID(), action: 'system.network.route.transition', targetType: 'system_settings', summary: { contextVersion: String(rows[0].context_version), effectiveRoute: state.projection.effectiveRoute, restartRequired: state.projection.restartRequired } });
    return state;
  }
}
