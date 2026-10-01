import test from 'node:test';
import assert from 'node:assert/strict';
import { buildServer } from '../../apps/api/src/server.mjs';
import { InMemoryIdentityRepository } from '../../src/identity/repository.mjs';
import { InMemoryAppRepository } from '../../src/apps/repository.mjs';
import { InMemoryPermissionRepository } from '../../src/permissions/repository.mjs';
import { InMemoryActionRepository } from '../../src/actions/repository.mjs';
import { InMemorySystemRepository } from '../../src/system/repository.mjs';
import { ActionRegistry } from '../../src/actions/registry.mjs';
import { InMemoryAuditRepository } from '../../src/audit/outbox.mjs';

const auth = async (app) => {
  const bootstrap=await app.inject({method:'POST',url:'/api/v1/identity/admin/bootstrap',payload:{displayName:'Runtime',credential:'runtime-secret'}});
  assert.equal(bootstrap.statusCode,201); return bootstrap.json().sessionId;
};
const manifest={appId:'com.example.api',version:'1.0.0',build:'1',releaseChannel:'stable',minRuntimeVersion:'1.0.0',entrypoints:{web:'index.html'},permissions:['settings.write'],capabilityAllowlist:['settings.write'],trustLevel:'official',uninstallPolicy:'allowed',backgroundPolicy:'none'};
test('Fastify runtime API enforces CSRF, catalog visibility and settings concurrency', async () => {
  const app=buildServer({logger:false,repository:new InMemoryIdentityRepository(),auditRepository:new InMemoryAuditRepository(),appRepository:new InMemoryAppRepository(),permissionRepository:new InMemoryPermissionRepository(),actionRepository:new InMemoryActionRepository(),systemRepository:new InMemorySystemRepository()}); const session=await auth(app); const headers={authorization:`Bearer ${session}`,cookie:`dgos_session=${session}`};
  const submit=await app.inject({method:'POST',url:'/api/v1/apps',headers,payload:{manifest,catalogState:'pending_review'}}); assert.equal(submit.statusCode,403);
  const writeHeaders={...headers,'x-dgos-csrf':'test'};
  const submitted=await app.inject({method:'POST',url:'/api/v1/apps',headers:writeHeaders,payload:{manifest,catalogState:'pending_review'}}); assert.equal(submitted.statusCode,201);
  const listed=await app.inject({method:'GET',url:'/api/v1/apps',headers}); assert.equal(listed.statusCode,200); assert.equal(listed.json().items.length,0);
  const approved=await app.inject({method:'POST',url:'/api/v1/apps/com.example.api/approve',headers:writeHeaders,payload:{version:'1.0.0',build:'1'}}); assert.equal(approved.statusCode,200);
  const publicList=await app.inject({method:'GET',url:'/api/v1/apps',headers}); assert.equal(publicList.json().items.length,1);
  const settings=await app.inject({method:'GET',url:'/api/v1/system/settings',headers}); assert.equal(settings.statusCode,200);
  const stale=await app.inject({method:'PATCH',url:'/api/v1/system/settings',headers:writeHeaders,payload:{baseVersion:'999',patch:{domain:'locale',value:{language:'zh-CN'}}}}); assert.equal(stale.statusCode,409);
  const invalid=await app.inject({method:'PATCH',url:'/api/v1/system/settings',headers:writeHeaders,payload:{baseVersion:settings.json().settingsVersion,patch:{domain:'locale',value:{language:3}}}}); assert.equal(invalid.statusCode,422);
  const undeclared=await app.inject({method:'POST',url:'/api/v1/permissions/check',headers,payload:{appId:'com.example.api',capability:'files.write',declared:[]}}); assert.equal(undeclared.statusCode,200); assert.equal(undeclared.json().decision,'deny');
  const ask=await app.inject({method:'POST',url:'/api/v1/permissions/request',headers,payload:{appId:'com.example.api',capability:'settings.write',declared:['settings.write'],requestId:'00000000-0000-0000-0000-000000000101'}}); assert.equal(ask.statusCode,202); assert.equal(ask.json().confirmationRequired,true);
  const actions=await app.inject({method:'GET',url:'/api/v1/actions',headers}); assert.equal(actions.statusCode,200); assert.ok(Array.isArray(actions.json().items));
  await app.close();
});

test('Fastify runtime API isolates API key subject fields', async () => {
  const app=buildServer({logger:false,repository:new InMemoryIdentityRepository(),auditRepository:new InMemoryAuditRepository(),appRepository:new InMemoryAppRepository(),permissionRepository:new InMemoryPermissionRepository(),actionRepository:new InMemoryActionRepository(),systemRepository:new InMemorySystemRepository()}); const session=await auth(app); const headers={authorization:`Bearer ${session}`,cookie:`dgos_session=${session}`,'x-dgos-csrf':'test'};
  const key=await app.inject({method:'POST',url:'/api/v1/secret/api-keys',headers,payload:{name:'runtime',scopes:['permission.read']}}); assert.equal(key.statusCode,201);
  const denied=await app.inject({method:'POST',url:'/api/v1/permissions/check',headers:{authorization:`ApiKey ${key.json().secret}`},payload:{subjectId:'other',appId:'com.example.api',capability:'settings.write',declared:['settings.write']}}); assert.equal(denied.statusCode,403);
  await app.close();
});

test('Fastify runtime API uses PostgreSQL repositories across server restart', async (t) => {
  if (!process.env.DGOS_DATABASE_URL) return t.skip('DGOS_DATABASE_URL is required');
  const pg=(await import('../../apps/api/node_modules/pg/lib/index.js')).default; const pool=new pg.Pool({connectionString:process.env.DGOS_DATABASE_URL});
  await pool.query('DELETE FROM audit_outbox'); await pool.query('DELETE FROM audit_events'); await pool.query('DELETE FROM admin_sessions'); await pool.query('DELETE FROM api_key_records'); await pool.query('DELETE FROM admin_principals'); await pool.query('DELETE FROM system_setting_events'); await pool.query('DELETE FROM system_settings');
  const app1=buildServer({logger:false}); app1.setErrorHandler((error, request, reply) => { reply.code(error.statusCode ?? 500).send({error:error.message,detail:error.detail}); }); const session=await auth(app1); const headers={authorization:`Bearer ${session}`,cookie:`dgos_session=${session}`,'x-dgos-csrf':'test'};
  const suffix=Date.now().toString(); const appId=`com.example.restart${suffix}`; const manifest={...manifestBase,appId};
  const submit=await app1.inject({method:'POST',url:'/api/v1/apps',headers,payload:{manifest,catalogState:'pending_review'}}); assert.equal(submit.statusCode,201,submit.body);
  assert.equal((await app1.inject({method:'POST',url:`/api/v1/apps/${appId}/approve`,headers,payload:{version:'1.0.0',build:'1'}})).statusCode,200);
  const installed=await app1.inject({method:'POST',url:`/api/v1/apps/${appId}/install`,headers,payload:{version:'1.0.0',build:'1'}}); assert.equal(installed.statusCode,200,installed.body);
  const settings=await app1.inject({method:'GET',url:'/api/v1/system/settings',headers}); assert.equal(settings.statusCode,200);
  const patched=await app1.inject({method:'PATCH',url:'/api/v1/system/settings',headers,payload:{baseVersion:settings.json().settingsVersion,patch:{domain:'locale',value:{language:'zh-CN'}}}}); assert.equal(patched.statusCode,200,patched.body);
  await app1.close();
  const app2=buildServer({logger:false}); const session2=session; const headers2={authorization:`Bearer ${session2}`,cookie:`dgos_session=${session2}`,'x-dgos-csrf':'test'};
  const list=await app2.inject({method:'GET',url:'/api/v1/apps',headers:headers2}); assert.equal(list.statusCode,200); assert.ok(list.json().items.some((item)=>item.appId===appId));
  const context=await app2.inject({method:'GET',url:'/api/v1/system/context',headers:headers2}); assert.equal(context.statusCode,200); assert.equal(context.json().settings.locale.language,'zh-CN');
  await app2.close(); await pool.query('DELETE FROM app_installs WHERE app_id=$1',[appId]); await pool.query('DELETE FROM app_versions WHERE app_id=$1',[appId]); await pool.query('DELETE FROM system_setting_events'); await pool.query('DELETE FROM system_settings'); await pool.end();
});

const manifestBase={appId:'com.example.api',version:'1.0.0',build:'1',releaseChannel:'stable',minRuntimeVersion:'1.0.0',entrypoints:{web:'index.html'},permissions:['settings.write'],capabilityAllowlist:['settings.write'],trustLevel:'official',uninstallPolicy:'allowed',backgroundPolicy:'none'};
