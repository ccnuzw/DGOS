import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import Fastify from '../../apps/api/node_modules/fastify/fastify.js';
import pg from '../../apps/api/node_modules/pg/lib/index.js';
import { registerExtensionRoutes } from '../../apps/api/src/extension-routes.mjs';
import { ExtensionSourceResolver } from '../../src/extensions/source-resolver.mjs';
import { InMemorySecretService } from '../../src/security/secret-service.mjs';
import { PostgresAuditRepository } from '../../src/audit/outbox.mjs';
import { createExtensionCredentialFingerprint } from '../../src/extensions/credential-fingerprint.mjs';
import { createTrustedBuiltinPermissionBroker } from '../../src/permissions/broker.mjs';
import { PostgresPermissionRepository } from '../../src/permissions/postgres-repository.mjs';

const url=process.env.DGOS_EXTENSION_TEST_DATABASE_URL;
test('public management routes enforce DTO, owner, transport and write-only credentials',{skip:!url},async()=>{
  if(!/^\/(?:dgos_v1_extensions(?:_[a-z0-9]+)?|dgos_v1_verify_[0-9a-f]{32})$/.test(new URL(url).pathname))throw new Error('test database name mismatch');
  const pool=new pg.Pool({connectionString:url});const app=Fastify();app.addHook('onRequest',async(request)=>{request.requestId=randomUUID();});
  try {
    const subjectId=randomUUID();const secretService=new InMemorySecretService();const audit=new PostgresAuditRepository(pool);
    const source='system:http_management_mcp',id=`http_${randomUUID().replaceAll('-','')}`;
    const config={transport:'stdio',runnerProfileId:'fixture'};
    const resolver=new ExtensionSourceResolver();resolver.register(source,{trustState:'trusted',manifest:{kind:'mcp',id,version:'1.0.0',requiresCredential:true,operations:[{operationId:'echo',permission:'mcp.tool.invoke',risk:'low',sideEffects:false,inputSchema:{type:'object',properties:{}}}]}});
    let trusted=false;
    const service=registerExtensionRoutes(app,{pool,audit,secretService,sourceResolver:resolver,permissions:{check:async()=>({decision:'allow'})},requireScope:async()=>({subjectId}),validateCsrf:async()=>{},trustedTransport:()=>trusted});
    service.management.credentialFingerprint=await createExtensionCredentialFingerprint({pool,secretService});
    service.management.templates=[{templateId:'fixture',version:'1.0.0',source,name:'Fixture',config,credentialFields:[{name:'apiKey',label:'API key',required:true}]}];
    const req=(method,path,payload)=>app.inject({method,url:`/api/v1${path}`,...(payload?{payload}:{})});
    const customId=`custom_${randomUUID().replaceAll('-','')}`;
    let response=await req('POST','/skills/custom',{requestId:randomUUID(),skillId:customId,content:{name:'One',description:'',systemPrompt:'PRIVATE_HTTP_PROMPT'},confirmed:true});assert.equal(response.statusCode,201,response.body);
    assert.equal(response.json().stateVersion,1);
    response=await req('GET',`/skills/${customId}/definition`);assert.equal(response.statusCode,200,response.body);assert.equal(response.headers['cache-control'],'no-store');assert.equal(response.json().content.systemPrompt,'PRIVATE_HTTP_PROMPT');
    response=await req('PATCH',`/skills/${customId}/definition`,{requestId:randomUUID(),baseVersion:1,patch:{name:'Renamed'}});assert.equal(response.statusCode,200,response.body);assert.equal(response.json().skillId,customId);
    response=await req('POST','/skills/custom',{requestId:randomUUID(),skillId:'evil',content:{name:'X',description:'',systemPrompt:'X'},confirmed:true,kind:'mcp'});assert.equal(response.statusCode,422);
    response=await req('GET','/mcp/templates');assert.equal(response.statusCode,200);assert.equal(response.json().items[0].setupState,'needs-credentials');
    response=await req('POST','/extensions/previews',{requestId:randomUUID(),kind:'mcp',source});assert.equal(response.statusCode,200,response.body);const preview=response.json();
    const install={requestId:randomUUID(),source,previewId:preview.previewId,previewDigest:preview.digest,confirmed:true,config,templateId:'fixture',templateVersion:'1.0.0',credentials:{apiKey:'PRIVATE_HTTP_CREDENTIAL'}};
    response=await req('POST','/mcp',install);assert.equal(response.statusCode,422,response.body);
    trusted=true;response=await req('POST','/mcp',install);assert.equal(response.statusCode,202,response.body);assert.equal(response.json().credentialStatus,'configured');assert.equal(response.body.includes('PRIVATE_HTTP_CREDENTIAL'),false);
    const first=response.json();response=await req('POST','/mcp',install);assert.equal(response.statusCode,202,response.body);assert.deepEqual(response.json(),first);
    response=await req('POST','/mcp',{...install,credentials:{apiKey:'DIFFERENT'}});assert.equal(response.statusCode,409,response.body);
    const {rows}=await pool.query('SELECT result::text FROM extension_mutations WHERE subject_id=$1',[subjectId]);assert.ok(rows.every((row)=>!row.result.includes('PRIVATE_HTTP_')));
  } finally {await app.close();await pool.end();}
});

test('custom Skill private definition read requires an explicit skill.read decision',{skip:!url},async()=>{
  if(!/^\/(?:dgos_v1_extensions(?:_[a-z0-9]+)?|dgos_v1_verify_[0-9a-f]{32})$/.test(new URL(url).pathname))throw new Error('test database name mismatch');
  const pool=new pg.Pool({connectionString:url});const app=Fastify();app.addHook('onRequest',async(request)=>{request.requestId=randomUUID();});
  try {
    const subjectId=randomUUID(),skillId=`read_${randomUUID().replaceAll('-','')}`;
    const audit=new PostgresAuditRepository(pool);
    const permissions=createTrustedBuiltinPermissionBroker({repository:new PostgresPermissionRepository(pool),audit});
    registerExtensionRoutes(app,{pool,audit,permissions,sourceResolver:new ExtensionSourceResolver(),requireScope:async()=>({subjectId}),validateCsrf:async()=>{}});
    const decide=(capability,decision)=>permissions.decide({subjectId,appId:'dgos.extensions',capability,scope:'*',decision,requestId:randomUUID()});
    await decide('skill.install','allow');
    const created=await app.inject({method:'POST',url:'/api/v1/skills/custom',payload:{requestId:randomUUID(),skillId,content:{name:'Private',description:'',systemPrompt:'PRIVATE_READ_PROMPT'},confirmed:true}});
    assert.equal(created.statusCode,201,created.body);
    const read=()=>app.inject({method:'GET',url:`/api/v1/skills/${skillId}/definition`});
    let response=await read();assert.equal(response.statusCode,409,response.body);assert.equal(response.json().message,'confirmation_required');assert.equal(response.body.includes('PRIVATE_READ_PROMPT'),false);
    await decide('skill.read','allow');
    response=await read();assert.equal(response.statusCode,200,response.body);assert.equal(response.headers['cache-control'],'no-store');assert.equal(response.json().content.systemPrompt,'PRIVATE_READ_PROMPT');
    await decide('skill.read','deny');
    response=await read();assert.equal(response.statusCode,403,response.body);assert.equal(response.json().message,'permission_denied');assert.equal(response.body.includes('PRIVATE_READ_PROMPT'),false);
    const {rows}=await pool.query("SELECT action,summary FROM audit_events WHERE actor_id=$1 AND action IN ('permission.check','extension.skill.definition.read') ORDER BY created_at",[subjectId]);
    assert.equal(rows.filter((row)=>row.action==='extension.skill.definition.read').length,1);
    assert.deepEqual(rows.filter((row)=>row.action==='permission.check'&&row.summary?.scope==='*').map((row)=>row.summary.decision),['allow','ask','allow','deny']);
  } finally {await app.close();await pool.end();}
});
