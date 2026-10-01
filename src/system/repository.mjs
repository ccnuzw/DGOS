export class InMemorySystemRepository {
  constructor() { this.settings = null; this.events = []; }
  async load() { return this.settings && structuredClone(this.settings); }
  async save(value, event) { this.settings = structuredClone(value); this.events.push(structuredClone(event)); }
  async eventsAfter(version) { return this.events.filter((e)=>Number(e.contextVersion)>Number(version)); }
}
export class PostgresSystemRepository {
  constructor(pool) { this.pool=pool; }
  async ensure(scopeId,settings) { await this.pool.query('INSERT INTO system_settings(scope_id,settings) VALUES($1,$2) ON CONFLICT(scope_id) DO NOTHING',[scopeId,JSON.stringify(settings)]); }
  async load(scopeId) { const {rows}=await this.pool.query('SELECT * FROM system_settings WHERE scope_id=$1',[scopeId]); return rows[0] && {settingsVersion:String(rows[0].settings_version),contextVersion:String(rows[0].context_version),settings:rows[0].settings}; }
  async save(scopeId,value,event) { const c=await this.pool.connect(); try { await c.query('BEGIN'); const {rows}=await c.query('UPDATE system_settings SET settings=$2,settings_version=settings_version+1,context_version=context_version+1,updated_at=now() WHERE scope_id=$1 AND settings_version=$3 RETURNING settings_version,context_version',[scopeId,JSON.stringify(value.settings),Number(value.settingsVersion)]); if(!rows[0]) throw Object.assign(new Error('version_conflict'),{statusCode:409}); await c.query('INSERT INTO system_setting_events(event_id,scope_id,context_version,domain,restart_required) VALUES($1,$2,$3,$4,$5)',[event.eventId,scopeId,rows[0].context_version,event.domain,event.restartRequired]); await c.query('COMMIT'); return {settingsVersion:String(rows[0].settings_version),contextVersion:String(rows[0].context_version)}; } catch(e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); } }
  async eventsAfter(scopeId,version) { const {rows}=await this.pool.query('SELECT context_version,domain,restart_required,created_at FROM system_setting_events WHERE scope_id=$1 AND context_version>$2 ORDER BY context_version',[scopeId,Number(version)]); return rows.map(r=>({contextVersion:String(r.context_version),domain:r.domain,restartRequired:r.restart_required,createdAt:r.created_at.toISOString()})); }
}
