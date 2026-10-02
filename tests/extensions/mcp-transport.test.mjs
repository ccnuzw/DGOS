import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IsolatedExtensionRunner } from '../../apps/extension-runner/src/runner.mjs';
import { ExtensionService } from '../../src/extensions/service.mjs';
import { InMemoryExtensionRepository } from '../../src/extensions/repository.mjs';
import { ExtensionSourceResolver } from '../../src/extensions/source-resolver.mjs';
import { InMemoryAuditRepository } from '../../src/audit/outbox.mjs';
import { randomUUID } from 'node:crypto';
import { ProviderEgress } from '../../src/security/provider-egress.mjs';

test('server-owned stdio profile keeps MCP process through calls and stops on disconnect',async()=>{
  const runner=new IsolatedExtensionRunner({runnerProfiles:{fixture:{command:process.execPath,allowedCommand:process.execPath,args:[fileURLToPath(new URL('./stdio-mcp-fixture.mjs',import.meta.url))],cwd:fileURLToPath(new URL('.',import.meta.url)),timeoutMs:2000}}});
  const config={transport:'stdio',runnerProfileId:'fixture'};
  const binding={subjectId:'subject-a',kind:'mcp',extensionId:'fixture',version:'1.0.0',config};
  const tools=await runner.connect(binding); assert.equal(tools[0].name,'echo');
  const first=await runner.invoke({...binding,operationId:'echo',input:{value:'a'}});
  const second=await runner.invoke({...binding,operationId:'echo',input:{value:'b'}});
  assert.equal(first.pid,second.pid); assert.notEqual(first.pid,process.pid);
  await runner.disconnect(binding);
  await assert.rejects(runner.invoke({...binding,operationId:'echo',input:{value:'c'}}),/connection_not_ready/);
});
test('server-owned stdio credential field reaches child without caller env control',async()=>{
  const runner=new IsolatedExtensionRunner({runnerProfiles:{credential:{command:process.execPath,allowedCommand:process.execPath,args:[fileURLToPath(new URL('./stdio-mcp-fixture.mjs',import.meta.url))],cwd:fileURLToPath(new URL('.',import.meta.url)),credentialEnv:{apiKey:'DGOS_MCP_TEST_CREDENTIAL'},timeoutMs:2000}}});
  const binding={subjectId:'credential-subject',kind:'mcp',extensionId:'credential',version:'1.0.0',config:{transport:'stdio',runnerProfileId:'credential'}};
  await assert.rejects(runner.connect(binding),/credential_unavailable/);
  try {await runner.connect({...binding,credentials:{apiKey:'fixture-secret'}});assert.deepEqual(await runner.invoke({...binding,operationId:'credential',input:{}}),{accepted:true});}
  finally {await runner.disconnect(binding);}
});
test('stdio sandbox rejects workspace-wide and secret profile roots before process start',async()=>{
  const cwd=fileURLToPath(new URL('.',import.meta.url));
  const binding={subjectId:'root-boundary',kind:'mcp',extensionId:'fixture',version:'1.0.0',config:{transport:'stdio',runnerProfileId:'restricted'}};
  for(const root of [fileURLToPath(new URL('../../',import.meta.url)),'/run','/var/lib/dgos','/workspace']) {
    const runner=new IsolatedExtensionRunner({runnerProfiles:{restricted:{command:process.execPath,args:[`${cwd}/stdio-mcp-fixture.mjs`],cwd,readOnlyRoots:[root],sandbox:process.platform==='darwin'?'macos-restricted':'linux-bwrap'}}});
    await assert.rejects(runner.connect(binding),/runner_profile_invalid/);
  }
});
test('macOS sandbox profile executes fixture while denying filesystem writes', {skip:process.platform!=='darwin'},async()=>{
  const cwd=fileURLToPath(new URL('.',import.meta.url));
  const canaryRoot=await mkdtemp(join(tmpdir(),'dgos-extension-private-'));
  const outside=join(canaryRoot,'outside.txt');const rootSecret=join(canaryRoot,'root-secret.txt');
  await writeFile(outside,'outside-canary',{mode:0o644});await writeFile(rootSecret,'root-secret-canary',{mode:0o644});
  const runner=new IsolatedExtensionRunner({runnerProfiles:{restricted:{command:process.execPath,allowedCommand:process.execPath,args:[`${cwd}/stdio-mcp-fixture.mjs`],cwd,sandbox:'macos-restricted',timeoutMs:2000}}});
  const binding={subjectId:'sandbox-subject',kind:'mcp',extensionId:'sandbox',version:'1.0.0',config:{transport:'stdio',runnerProfileId:'restricted'}};
  try { const tools=await runner.connect(binding); assert.equal(tools[0].name,'echo'); assert.equal((await runner.invoke({...binding,operationId:'echo',input:{value:'sandboxed'}})).value,'sandboxed'); const probe=await runner.invoke({...binding,operationId:'probe',input:{readPaths:[outside,rootSecret]}}); assert.deepEqual(probe.readDenied,[true,true]);assert.equal(probe.writeDenied,true); assert.equal(probe.networkDenied,true); }
  finally { await runner.disconnect(binding);await rm(canaryRoot,{recursive:true,force:true}); }
});
test('server-owned HTTP endpoint completes MCP initialize, discovery, call, and disconnect',async()=>{
  const methods=[]; const server=createServer(async(req,res)=>{let text='';for await(const part of req)text+=part; const m=text?JSON.parse(text):{}; methods.push(m.method??req.method); res.setHeader('content-type','application/json'); if(req.method==='DELETE'){res.end();return;} const result=m.method==='tools/list'?{tools:[{name:'echo'}]}:m.method==='tools/call'?{structuredContent:{value:m.params.arguments.value}}:{}; res.end(JSON.stringify({jsonrpc:'2.0',id:m.id,result}));});
  await new Promise((resolve)=>server.listen(0,'127.0.0.1',resolve));
  try { const runner=new IsolatedExtensionRunner({endpointProfiles:{fixture:{endpoint:`http://127.0.0.1:${server.address().port}`,allowHttpFixture:true}}}); const config={transport:'streamable-http',endpointRef:'fixture'}; const binding={subjectId:'subject-a',kind:'mcp',extensionId:'http_fixture',version:'1.0.0',config}; await runner.connect(binding); const result=await runner.invoke({...binding,operationId:'echo',input:{value:'ok'}}); assert.equal(result.value,'ok'); await runner.disconnect(binding); assert.deepEqual(methods,['initialize','notifications/initialized','tools/list','tools/call']); }
  finally { await new Promise((resolve)=>server.close(resolve)); }
});
test('server-owned HTTP credential header reaches MCP and is required',async()=>{
  const server=createServer(async(req,res)=>{if(req.headers.authorization!=='Bearer fixture-secret'){res.writeHead(401);res.end();return;}let text='';for await(const part of req)text+=part;const message=text?JSON.parse(text):{};res.setHeader('content-type','application/json');res.end(JSON.stringify({jsonrpc:'2.0',id:message.id,result:message.method==='tools/list'?{tools:[{name:'echo'}]}:message.method==='tools/call'?{structuredContent:{accepted:true}}:{}}));});
  await new Promise((resolve)=>server.listen(0,'127.0.0.1',resolve));
  const runner=new IsolatedExtensionRunner({endpointProfiles:{credential:{endpoint:`http://127.0.0.1:${server.address().port}`,allowHttpFixture:true,credentialHeaders:{apiKey:{name:'authorization',prefix:'Bearer '}}}}});
  const binding={subjectId:'credential-subject',kind:'mcp',extensionId:'credential',version:'1.0.0',config:{transport:'streamable-http',endpointRef:'credential'}};
  try {await assert.rejects(runner.connect(binding),/credential_unavailable/);await runner.connect({...binding,credentials:{apiKey:'fixture-secret'}});assert.deepEqual(await runner.invoke({...binding,operationId:'echo',input:{}}),{accepted:true});}
  finally {await runner.disconnect(binding);await new Promise((resolve)=>server.close(resolve));}
});
test('HTTP MCP egress rejects private HTTPS addresses before transport',async()=>{
  const egress=new ProviderEgress({lookup:async()=>[{address:'127.0.0.1'}],allowHosts:['mcp.example.test']});
  const runner=new IsolatedExtensionRunner({endpointProfiles:{blocked:{endpoint:'https://mcp.example.test/mcp',egressPolicyId:'mcp-public',egress}}});
  const binding={subjectId:'subject-a',kind:'mcp',extensionId:'blocked',version:'1.0.0',config:{transport:'streamable-http',endpointRef:'blocked'}};
  await assert.rejects(runner.connect(binding),/policy_blocked/);
  await runner.close();
});
test('service invokes persisted run through persistent stdio MCP transport',async()=>{
  const runner=new IsolatedExtensionRunner({runnerProfiles:{fixture:{command:process.execPath,allowedCommand:process.execPath,args:[fileURLToPath(new URL('./stdio-mcp-fixture.mjs',import.meta.url))],cwd:fileURLToPath(new URL('.',import.meta.url)),timeoutMs:2000}}});
  const resolver=new ExtensionSourceResolver(); resolver.register('bundled:stdio_fixture',{trustState:'trusted',manifest:{kind:'mcp',id:'stdio_fixture',version:'1.0.0',operations:[{operationId:'echo',permission:'mcp.tool.invoke',risk:'low',sideEffects:false,inputSchema:{type:'object',required:['value'],properties:{value:{type:'string'}}}}]}});
  const repository=new InMemoryExtensionRepository(); const service=new ExtensionService({repository,permissions:{check:async()=>({decision:'allow'})},audit:new InMemoryAuditRepository(),sourceResolver:resolver,runner,appAccess:async()=>true,verifyConfirmation:async()=>true});
  const subjectId=randomUUID(); const preview=await service.preview({kind:'mcp',source:'bundled:stdio_fixture',subjectId,requestId:randomUUID()});
  const installed=await service.install({kind:'mcp',source:'bundled:stdio_fixture',previewId:preview.previewId,previewDigest:preview.digest,subjectId,requestId:randomUUID(),confirmed:true,config:{transport:'stdio',runnerProfileId:'fixture'}});
  const enabled=await service.setState({kind:'mcp',id:'stdio_fixture',desiredState:'enabled',subjectId,requestId:randomUUID(),baseVersion:installed.stateVersion});
  const connected=await service.connect({id:'stdio_fixture',subjectId,requestId:randomUUID(),baseVersion:enabled.stateVersion,confirmed:true});
  assert.equal(connected.connectionState,'connecting'); await service.processConnectionIntents();
  const requestId=randomUUID(); const run=await service.submit({kind:'mcp',id:'stdio_fixture',operationId:'echo',extensionVersion:'1.0.0',input:{value:'live'},subjectId,appId:'dgos.extensions',requestId,confirmationId:'approved'});
  await service.process(run.runId);
  assert.equal((await service.getRun({runId:run.runId,subjectId})).resultSummary.value,'live');
  const current=(await service.list({kind:'mcp',subjectId})).items[0];
  await service.disconnect({id:'stdio_fixture',subjectId,requestId:randomUUID(),baseVersion:current.stateVersion}); await service.processConnectionIntents();
});
