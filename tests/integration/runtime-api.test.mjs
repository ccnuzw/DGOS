import test from 'node:test';
import assert from 'node:assert/strict';
import { buildServer } from '../../apps/api/src/server.mjs';

const auth = async (app) => {
  const bootstrap=await app.inject({method:'POST',url:'/api/v1/identity/admin/bootstrap',payload:{displayName:'Runtime',credential:'runtime-secret'}});
  assert.equal(bootstrap.statusCode,201); return bootstrap.json().sessionId;
};
const manifest={appId:'com.example.api',version:'1.0.0',build:'1',releaseChannel:'stable',minRuntimeVersion:'1.0.0',entrypoints:{web:'index.html'},permissions:['settings.write'],capabilityAllowlist:['settings.write'],trustLevel:'official',uninstallPolicy:'allowed',backgroundPolicy:'none'};
test('Fastify runtime API enforces CSRF, catalog visibility and settings concurrency', async () => {
  const app=buildServer({logger:false}); const session=await auth(app); const headers={authorization:`Bearer ${session}`,cookie:`dgos_session=${session}`};
  const submit=await app.inject({method:'POST',url:'/api/v1/apps',headers,payload:{manifest,catalogState:'pending_review'}}); assert.equal(submit.statusCode,403);
  const writeHeaders={...headers,'x-dgos-csrf':'test'};
  const submitted=await app.inject({method:'POST',url:'/api/v1/apps',headers:writeHeaders,payload:{manifest,catalogState:'pending_review'}}); assert.equal(submitted.statusCode,201);
  const listed=await app.inject({method:'GET',url:'/api/v1/apps',headers}); assert.equal(listed.statusCode,200); assert.equal(listed.json().items.length,0);
  const approved=await app.inject({method:'POST',url:'/api/v1/apps/com.example.api/approve',headers:writeHeaders,payload:{version:'1.0.0',build:'1'}}); assert.equal(approved.statusCode,200);
  const publicList=await app.inject({method:'GET',url:'/api/v1/apps',headers}); assert.equal(publicList.json().items.length,1);
  const settings=await app.inject({method:'GET',url:'/api/v1/system/settings',headers}); assert.equal(settings.statusCode,200);
  const stale=await app.inject({method:'PATCH',url:'/api/v1/system/settings',headers:writeHeaders,payload:{baseVersion:'999',patch:{domain:'locale',value:{language:'zh-CN'}}}}); assert.equal(stale.statusCode,409);
  const invalid=await app.inject({method:'PATCH',url:'/api/v1/system/settings',headers:writeHeaders,payload:{baseVersion:settings.json().settingsVersion,patch:{domain:'locale',value:{language:3}}}}); assert.equal(invalid.statusCode,422);
  await app.close();
});

test('Fastify runtime API isolates API key subject fields', async () => {
  const app=buildServer({logger:false}); const session=await auth(app); const headers={authorization:`Bearer ${session}`,cookie:`dgos_session=${session}`,'x-dgos-csrf':'test'};
  const key=await app.inject({method:'POST',url:'/api/v1/secret/api-keys',headers,payload:{name:'runtime',scopes:['permission.read']}}); assert.equal(key.statusCode,201);
  const denied=await app.inject({method:'POST',url:'/api/v1/permissions/check',headers:{authorization:`ApiKey ${key.json().secret}`},payload:{subjectId:'other',appId:'com.example.api',capability:'settings.write',declared:['settings.write']}}); assert.equal(denied.statusCode,403);
  await app.close();
});
