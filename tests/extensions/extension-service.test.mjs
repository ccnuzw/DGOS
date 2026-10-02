import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { InMemoryExtensionRepository } from '../../src/extensions/repository.mjs';
import { ExtensionService } from '../../src/extensions/service.mjs';
import { ExtensionSourceResolver } from '../../src/extensions/source-resolver.mjs';
import { IsolatedExtensionRunner } from '../../apps/extension-runner/src/runner.mjs';
import { InMemoryAuditRepository } from '../../src/audit/outbox.mjs';

const fixtureUrl = new URL('./fixture-handler.mjs', import.meta.url);
const manifest = { kind:'mcp',id:'fixture',version:'1.0.0',name:'Fixture',operations:[{operationId:'echo',permission:'mcp.tool.invoke',risk:'low',sideEffects:false,inputSchema:{type:'object',required:['value'],properties:{value:{type:'string'}}}}] };
function setup({ decision='allow', handlers, clock }={}) {
  const repository=new InMemoryExtensionRepository(); const audit=new InMemoryAuditRepository();
  const permissions={check:async()=>({decision})}; const resolver=new ExtensionSourceResolver();
  resolver.register('bundled:fixture',{manifest,trustState:'trusted'});
  const runner=new IsolatedExtensionRunner({handlers:handlers??{'mcp:fixture:__connect':{moduleUrl:fixtureUrl.href,exportName:'connect'},'mcp:fixture:echo':{moduleUrl:fixtureUrl.href,exportName:'echo'}},allowedModuleRoots:[dirname(fileURLToPath(fixtureUrl))]});
  const service=new ExtensionService({repository,permissions,audit,sourceResolver:resolver,runner,clock,appAccess:async()=>true,verifyConfirmation:async({confirmationId,requestId})=>confirmationId===`${requestId}:permission`});
  return {service,repository,audit,resolver,runner};
}
async function ready(service,subjectId=randomUUID()) {
  const source='bundled:fixture';
  const preview=await service.preview({kind:'mcp',source,subjectId,requestId:randomUUID()});
  const installed=await service.install({kind:'mcp',source,previewId:preview.previewId,previewDigest:preview.digest,subjectId,requestId:randomUUID(),confirmed:true});
  await service.setState({kind:'mcp',id:'fixture',desiredState:'enabled',subjectId,requestId:randomUUID(),baseVersion:installed.stateVersion});
  await service.connect({id:'fixture',subjectId,requestId:randomUUID(),baseVersion:installed.stateVersion+1,confirmed:true});
  await service.processConnectionIntents();
  return subjectId;
}
test('permission and confirmation reject before install or process start', async()=>{
  const denied=setup({decision:'deny'}); const subjectId=randomUUID();
  await assert.rejects(denied.service.preview({kind:'mcp',source:'bundled:fixture',subjectId,requestId:randomUUID()}),/permission_denied/);
  assert.equal(denied.repository.previews.size,0);
  const {service,repository}=setup(); const preview=await service.preview({kind:'mcp',source:'bundled:fixture',subjectId,requestId:randomUUID()});
  await assert.rejects(service.install({kind:'mcp',source:'bundled:fixture',previewId:preview.previewId,subjectId,requestId:randomUUID()}),/confirmation_required/);
  assert.equal(repository.installs.size,0);
});
test('managed MCP connection and run use one process, idempotent request, and redacted snapshot', async()=>{
  const {service,repository}=setup(); const subjectId=await ready(service); const appId='dgos.extensions'; const requestId=randomUUID();
  const first=await service.submit({kind:'mcp',id:'fixture',operationId:'echo',extensionVersion:'1.0.0',input:{value:'hello'},subjectId,appId,requestId,confirmationId:`${requestId}:permission`});
  const replay=await service.submit({kind:'mcp',id:'fixture',operationId:'echo',extensionVersion:'1.0.0',input:{value:'hello'},subjectId,appId,requestId,confirmationId:`${requestId}:permission`});
  assert.equal(first.runId,replay.runId);
  await service.process(first.runId);
  const done=await service.getRun({runId:first.runId,subjectId});
  assert.equal(done.state,'succeeded'); assert.equal((await repository.getRun(first.runId,subjectId)).handlerCalls,1);
  assert.notEqual(done.resultSummary.pid,process.pid); assert.equal(done.resultSummary.home,'/nonexistent'); assert.equal(done.resultSummary.leaked,false);
  assert.equal((await service.events({runId:first.runId,subjectId,after:1})).items.length,2);
  assert.equal((await service.list({kind:'mcp',subjectId})).items[0].toolCount,1);
  assert.equal(repository.runs.size,1);
});
test('cancel queued and timeout running do not retry handler', async()=>{
  const {service,repository}=setup({handlers:{'mcp:fixture:__connect':{moduleUrl:fixtureUrl.href,exportName:'connect'},'mcp:fixture:echo':{moduleUrl:fixtureUrl.href,exportName:'slow'}}}); const subjectId=await ready(service);
  const queuedRequestId=randomUUID(); const queued=await service.submit({kind:'mcp',id:'fixture',operationId:'echo',extensionVersion:'1.0.0',input:{value:'a'},subjectId,appId:'dgos.extensions',requestId:queuedRequestId,confirmationId:`${queuedRequestId}:permission`});
  assert.equal((await service.cancel({runId:queued.runId,subjectId,requestId:randomUUID()})).state,'cancelled');
  assert.equal((await repository.getRun(queued.runId,subjectId)).handlerCalls,0);
  const slowRequestId=randomUUID(); const slow=await service.submit({kind:'mcp',id:'fixture',operationId:'echo',extensionVersion:'1.0.0',input:{value:'b'},subjectId,appId:'dgos.extensions',requestId:slowRequestId,confirmationId:`${slowRequestId}:permission`,timeoutMs:100});
  await service.process(slow.runId);
  assert.equal((await service.getRun({runId:slow.runId,subjectId})).state,'timed_out');
  assert.equal((await repository.getRun(slow.runId,subjectId)).handlerCalls,1);
});
test('recovery marks uncertain claimed execution and never dispatches it again', async()=>{
  const {service,repository}=setup({clock:()=>Date.now()+20_000}); const subjectId=await ready(service);
  const requestId=randomUUID(); const run=await service.submit({kind:'mcp',id:'fixture',operationId:'echo',extensionVersion:'1.0.0',input:{value:'x'},subjectId,appId:'dgos.extensions',requestId,confirmationId:`${requestId}:permission`});
  await repository.claim(run.runId,'dead-worker',1);
  await new Promise((resolve)=>setTimeout(resolve,5));
  await service.reconcile();
  assert.equal((await service.getRun({runId:run.runId,subjectId})).reasonCode,'execution_uncertain');
  assert.equal((await repository.getRun(run.runId,subjectId)).handlerCalls,1);
  assert.equal(await service.process(run.runId),undefined);
});
test('preview is owner and digest bound; raw process fields are rejected', async()=>{
  const {service,repository}=setup(); const owner=randomUUID();
  const preview=await service.preview({kind:'mcp',source:'bundled:fixture',subjectId:owner,requestId:randomUUID()});
  const base={kind:'mcp',source:'bundled:fixture',previewId:preview.previewId,previewDigest:preview.digest,confirmed:true};
  await assert.rejects(service.install({...base,subjectId:randomUUID(),requestId:randomUUID()}),/preview_expired/);
  await assert.rejects(service.install({...base,previewDigest:'bad',subjectId:owner,requestId:randomUUID()}),/preview_expired/);
  for(const config of [{command:'node'},{cwd:'/tmp'},{env:{X:'1'}},{transport:'stdio',runnerProfileId:'fixture',settings:{token:'secret'}}])
    await assert.rejects(service.install({...base,config,subjectId:owner,requestId:randomUUID()}));
  assert.equal(repository.installs.size,0);
});
test('concurrent connect uses one attempt and cancellation reaches live child', async()=>{
  let connects=0; const {service,repository}=setup({handlers:{'mcp:fixture:__connect':async()=>{connects++; await new Promise((r)=>setTimeout(r,50)); return {healthy:true,tools:[{operationId:'echo'}]};},'mcp:fixture:echo':{moduleUrl:fixtureUrl.href,exportName:'slow'}}});
  const subjectId=randomUUID(); const source='bundled:fixture'; const preview=await service.preview({kind:'mcp',source,subjectId,requestId:randomUUID()});
  const installed=await service.install({kind:'mcp',source,previewId:preview.previewId,previewDigest:preview.digest,subjectId,requestId:randomUUID(),confirmed:true});
  const enabled=await service.setState({kind:'mcp',id:'fixture',desiredState:'enabled',subjectId,requestId:randomUUID(),baseVersion:installed.stateVersion});
  const [a,b]=await Promise.all([service.connect({id:'fixture',subjectId,requestId:randomUUID(),baseVersion:enabled.stateVersion,confirmed:true}),service.connect({id:'fixture',subjectId,requestId:randomUUID(),baseVersion:enabled.stateVersion,confirmed:true})]);
  await service.processConnectionIntents();
  assert.equal(connects,1); assert.equal(a.connectionAttemptId,b.connectionAttemptId);
  const requestId=randomUUID(); const run=await service.submit({kind:'mcp',id:'fixture',operationId:'echo',extensionVersion:'1.0.0',input:{value:'x'},subjectId,appId:'dgos.extensions',requestId,confirmationId:`${requestId}:permission`});
  const processing=service.process(run.runId);
  await new Promise((resolve)=>setTimeout(resolve,25));
  const cancelling=await service.cancel({runId:run.runId,subjectId,requestId:randomUUID()});
  assert.equal(cancelling.state,'cancel_requested');
  await processing;
  assert.equal((await service.getRun({runId:run.runId,subjectId})).state,'cancelled');
  assert.equal((await repository.getRun(run.runId,subjectId)).handlerCalls,1);
});
test('skill package and child IDs remain distinct; untrusted preview cannot install', async()=>{
  const {service,resolver}=setup(); const subjectId=randomUUID();
  const skill={kind:'skill',id:'summarize',packageId:'writing_tools',childSkillIds:['summarize'],version:'1.0.0',operations:[{operationId:'run',permission:'skill.execute',risk:'medium',sideEffects:false,inputSchema:{type:'object',properties:{text:{type:'string'}}}}]};
  resolver.register('registry:writing_tools',{manifest:skill,trustState:'untrusted'});
  const preview=await service.preview({kind:'skill',source:'registry:writing_tools',subjectId,requestId:randomUUID()});
  assert.equal(preview.trustState,'rejected'); assert.deepEqual(preview.summary.childSkillIds,['summarize']);
  await assert.rejects(service.install({kind:'skill',source:'registry:writing_tools',previewId:preview.previewId,previewDigest:preview.digest,subjectId,requestId:randomUUID(),confirmed:true}),/source_untrusted/);
});
