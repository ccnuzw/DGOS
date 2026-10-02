import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import dns from 'node:dns/promises';
import { validateProxyConfig, validateProxyPolicy } from './proxy-transport.mjs';

const error = (name, statusCode) => Object.assign(new Error(name), { statusCode });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hmacRef = (version) => `proxy_provisioning_hmac_v${version}`;
const secretTtlMs = 10 * 365 * 24 * 60 * 60 * 1000;
const leaseMs = 60_000;
const receipt = (row) => ({ requestId: row.request_id, manualProxyRef: row.secret_ref, displayName: row.display_name, status: 'stored', credentialStatus: row.credential_status });

function canonical(input, { allowLocalFixture }) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some((key) => !['requestId', 'displayName', 'endpoint', 'username', 'password'].includes(key)) || !uuid.test(input.requestId ?? '')) throw error('invalid_request', 422);
  const name = typeof input.displayName === 'string' ? input.displayName.trim() : undefined;
  if (typeof input.displayName !== 'string' || !name || name.length > 128 || /[\x00-\x1f\x7f]|(?:https?:\/\/|@|password\s*[:=]|token\s*[:=])/i.test(name)) throw error('invalid_request', 422);
  if (typeof input.endpoint !== 'string' || input.endpoint.length > 2048 || /[\x00-\x20\x7f]/.test(input.endpoint)) throw error('proxy_configuration_invalid', 422);
  let url;
  try {
    url = new URL(input.endpoint);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/' || !['https:', 'http:'].includes(url.protocol)) throw Error();
    if (input.endpoint !== url.origin && input.endpoint !== `${url.origin}/`) throw Error();
    validateProxyConfig({ url: url.toString() }, { allowLocalFixture });
  } catch { throw error('proxy_configuration_invalid', 422); }
  const hasUser = Object.hasOwn(input, 'username');
  const hasPassword = Object.hasOwn(input, 'password');
  if (hasUser !== hasPassword) throw error('invalid_request', 422);
  let authorization;
  if (hasUser) {
    if (typeof input.username !== 'string' || typeof input.password !== 'string' || !input.username || !input.password || input.username.length > 128 || input.password.length > 128 || /[:\x00-\x1f\x7f]/.test(input.username) || /[\x00-\x1f\x7f]/.test(input.password)) throw error('invalid_request', 422);
    const bytes = Buffer.from(`${input.username}:${input.password}`, 'utf8');
    if (bytes.length > 384 || Math.ceil(bytes.length / 3) * 4 > 512) throw error('invalid_request', 422);
    authorization = `Basic ${bytes.toString('base64')}`;
  }
  return { requestId: input.requestId, displayName: name, url: url.toString(), authorization, credentialStatus: hasUser ? 'configured' : 'not_required' };
}

export class PostgresProxyProvisioning {
  constructor({ pool, secretService, lookup = (host) => dns.lookup(host, { all: true }), allowLocalFixture = false, hmacVersion = 1 } = {}) {
    if (!pool?.connect || !secretService?.resolve || !secretService?.put || !secretService?.revoke || !secretService?.inspect) throw new Error('proxy_provisioning_dependencies_required');
    if (!Number.isSafeInteger(hmacVersion) || hmacVersion < 1) throw new Error('proxy_provisioning_dependencies_required');
    if (allowLocalFixture && process.env.NODE_ENV === 'production') throw new Error('proxy_provisioning_dependencies_required');
    this.pool = pool; this.secretService = secretService; this.lookup = lookup; this.allowLocalFixture = allowLocalFixture; this.hmacVersion = hmacVersion;
  }
  async initializeKey() {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(50710051, $1)', [this.hmacVersion]);
      const ref = hmacRef(this.hmacVersion);
      const state = await this.secretService.inspect(ref);
      if (state.credentialState === 'missing') {
        await this.secretService.put({ secretRef: ref, purpose: 'network-provisioning-hmac', subjectId: 'system', value: randomBytes(32).toString('base64url'), ttlMs: secretTtlMs, expectedVersion: 0 });
      } else if (state.credentialState !== 'available') throw error('credential_unavailable', 503);
      await this.key();
      await client.query('COMMIT');
    } catch {
      await client.query('ROLLBACK').catch(() => {});
      throw error('credential_unavailable', 503);
    } finally { client.release(); }
  }
  async key(version = this.hmacVersion) {
    try {
      const handle = await this.secretService.resolve({ secretRef: hmacRef(version), purpose: 'network-provisioning-hmac', subjectId: 'system' });
      const key = Buffer.from(await handle.read(), 'base64url');
      if (key.length !== 32) throw Error();
      return key;
    } catch { throw error('credential_unavailable', 503); }
  }
  async assertCommittedRef(ref) {
    const { rows } = await this.pool.query("SELECT 1 FROM network_proxy_provisioning WHERE secret_ref=$1 AND state='committed'", [ref]);
    if (!rows[0]) throw error('credential_unavailable', 503);
  }
  async provision(actorId, input) {
    if (!uuid.test(actorId ?? '')) throw error('insufficient_scope', 403);
    const value = canonical(input, this);
    try { await validateProxyPolicy({ url: value.url }, { lookup: this.lookup, allowLocalFixture: this.allowLocalFixture }); }
    catch (cause) { throw error(cause.errorKey === 'network_unreachable' ? 'credential_unavailable' : cause.errorKey ?? 'policy_blocked', cause.errorKey === 'network_unreachable' ? 503 : 422); }
    const material = JSON.stringify({ url: value.url, authorization: value.authorization ?? null, displayName: value.displayName, credentialStatus: value.credentialStatus });
    const fingerprintFor = (key) => createHmac('sha256', key).update(material).digest('hex');
    const fingerprint = fingerprintFor(await this.key());
    const generatedRef = `proxy_${randomBytes(32).toString('base64url')}`;
    const client = await this.pool.connect();
    let row;
    try {
      await client.query('BEGIN');
      const result = await client.query(`INSERT INTO network_proxy_provisioning(actor_id,request_id,secret_ref,fingerprint,hmac_version,display_name,credential_status,state,lease_until)
        VALUES($1,$2,$3,$4,$5,$6,$7,'prepared',now()+($8::int * interval '1 millisecond')) ON CONFLICT(actor_id,request_id) DO NOTHING RETURNING *`, [actorId, value.requestId, generatedRef, fingerprint, this.hmacVersion, value.displayName, value.credentialStatus, leaseMs]);
      const inserted = Boolean(result.rows[0]);
      row = result.rows[0] ?? (await client.query('SELECT * FROM network_proxy_provisioning WHERE actor_id=$1 AND request_id=$2', [actorId, value.requestId])).rows[0];
      await client.query('COMMIT');
      if (!inserted) {
        if (row.fingerprint !== fingerprintFor(await this.key(Number(row.hmac_version)))) throw error('version_conflict', 409);
        if (row.state === 'committed') return receipt(row);
        throw error('request_conflict', 409);
      }
    } catch (cause) { await client.query('ROLLBACK').catch(() => {}); throw cause; }
    finally { client.release(); }

    const write = await this.pool.connect();
    let writeFailed = false;
    try {
      await write.query('BEGIN');
      await write.query('SELECT 1 FROM network_proxy_provisioning WHERE actor_id=$1 AND request_id=$2 FOR UPDATE', [actorId, value.requestId]);
      await this.secretService.put({ secretRef: row.secret_ref, purpose: 'network-proxy', subjectId: 'system', value: JSON.stringify({ url: value.url, ...(value.authorization ? { authorization: value.authorization } : {}) }), ttlMs: secretTtlMs, expectedVersion: 0, requestId: value.requestId });
      const handle = await this.secretService.resolve({ secretRef: row.secret_ref, purpose: 'network-proxy', subjectId: 'system' });
      if (handle.version !== 1) throw Error();
      await handle.read();
      await write.query('COMMIT');
    } catch {
      writeFailed = true;
      await write.query('ROLLBACK').catch(() => {});
    } finally { write.release(); }
    if (writeFailed) { await this.compensate(row); throw error('credential_unavailable', 503); }
    let commit;
    try {
      commit = await this.pool.connect();
      await commit.query('BEGIN');
      const updated = await commit.query("UPDATE network_proxy_provisioning SET state='committed',updated_at=now() WHERE actor_id=$1 AND request_id=$2 AND state='prepared' RETURNING *", [actorId, value.requestId]);
      if (!updated.rows[0]) throw error('request_conflict', 409);
      const eventId = randomUUID();
      await commit.query("INSERT INTO audit_events(event_id,request_id,actor_type,actor_id,action,target_type,result,summary) VALUES($1,$2,'admin',$3,'system.network.proxy.provision','network_proxy_configuration','succeeded',$4)", [eventId, value.requestId, actorId, JSON.stringify({ credentialStatus: value.credentialStatus })]);
      await commit.query('INSERT INTO audit_outbox(event_id) VALUES($1)', [eventId]);
      await commit.query('COMMIT');
      return receipt(updated.rows[0]);
    } catch {
      await commit?.query('ROLLBACK').catch(() => {});
      await this.compensate(row);
      throw error('credential_unavailable', 503);
    } finally { commit?.release(); }
  }
  async compensate(row) {
    let client;
    try {
      client = await this.pool.connect();
      await client.query('BEGIN');
      const state = await client.query('SELECT state FROM network_proxy_provisioning WHERE actor_id=$1 AND request_id=$2 FOR UPDATE', [row.actor_id, row.request_id]);
      if (!['prepared', 'compensating'].includes(state.rows[0]?.state)) { await client.query('COMMIT'); return; }
      const inUse = await client.query("SELECT 1 FROM system_settings WHERE settings #>> '{network,manualProxyRef}'=$1 LIMIT 1", [row.secret_ref]);
      if (inUse.rows[0]) { await client.query('ROLLBACK'); return; }
      await client.query("UPDATE network_proxy_provisioning SET state='compensating',lease_until=now(),updated_at=now() WHERE actor_id=$1 AND request_id=$2", [row.actor_id, row.request_id]);
      await client.query('COMMIT');
      await this.secretService.revoke(row.secret_ref, { requestId: row.request_id });
      await this.pool.query("UPDATE network_proxy_provisioning SET state='compensated',updated_at=now() WHERE actor_id=$1 AND request_id=$2 AND state='compensating'", [row.actor_id, row.request_id]);
    } catch { await client?.query('ROLLBACK').catch(() => {}); /* Durable intent is retried by recover(). */ }
    finally { client?.release(); }
  }
  async recover() {
    const { rows } = await this.pool.query("SELECT * FROM network_proxy_provisioning WHERE state IN ('prepared','compensating') AND lease_until<now() ORDER BY created_at LIMIT 100");
    for (const row of rows) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        const locked = await client.query("SELECT * FROM network_proxy_provisioning WHERE actor_id=$1 AND request_id=$2 AND state IN ('prepared','compensating') AND lease_until<now() FOR UPDATE SKIP LOCKED", [row.actor_id, row.request_id]);
        if (!locked.rows[0]) { await client.query('COMMIT'); continue; }
        const inUse = await client.query("SELECT 1 FROM system_settings WHERE settings #>> '{network,manualProxyRef}'=$1 LIMIT 1", [row.secret_ref]);
        if (inUse.rows[0]) { await client.query('ROLLBACK'); continue; }
        await client.query("UPDATE network_proxy_provisioning SET state='compensating',lease_until=now()+($3::int * interval '1 millisecond'),updated_at=now() WHERE actor_id=$1 AND request_id=$2", [row.actor_id, row.request_id, leaseMs]);
        await this.secretService.revoke(row.secret_ref, { requestId: row.request_id });
        await client.query("UPDATE network_proxy_provisioning SET state='compensated',updated_at=now() WHERE actor_id=$1 AND request_id=$2 AND state='compensating'", [row.actor_id, row.request_id]);
        await client.query('COMMIT');
      } catch { await client.query('ROLLBACK').catch(() => {}); }
      finally { client.release(); }
    }
  }
}

export { hmacRef as proxyProvisioningHmacRef };
