import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { IsolatedExtensionRunner } from '../../apps/extension-runner/src/runner.mjs';
import { ExtensionService } from '../../src/extensions/service.mjs';
import { InMemoryExtensionRepository } from '../../src/extensions/repository.mjs';
import { ExtensionSourceResolver } from '../../src/extensions/source-resolver.mjs';
import { createDeploymentAppAccess } from '../../src/extensions/runtime.mjs';

test('same MCP ID is isolated across subjects and disconnects', async()=>{
  const cwd=fileURLToPath(new URL('.',import.meta.url));
  const runner=new IsolatedExtensionRunner({runnerProfiles:{a:{command:process.execPath,args:[`${cwd}/stdio-mcp-fixture.mjs`],cwd},b:{command:process.execPath,args:[`${cwd}/stdio-mcp-fixture.mjs`],cwd}}});
  const one={subjectId:'subject-a',kind:'mcp',extensionId:'same',version:'1.0.0',config:{transport:'stdio',runnerProfileId:'a'}};
  const two={subjectId:'subject-b',kind:'mcp',extensionId:'same',version:'1.0.0',config:{transport:'stdio',runnerProfileId:'b'}};
  await runner.connect(one); await runner.connect(two);
  const a=await runner.invoke({...one,operationId:'echo',input:{value:'a'}});
  const b=await runner.invoke({...two,operationId:'echo',input:{value:'b'}});
  assert.notEqual(a.pid,b.pid);
  await runner.disconnect(one);
  assert.equal((await runner.invoke({...two,operationId:'echo',input:{value:'still-b'}})).value,'still-b');
  await runner.disconnect(two);
});

test('API connect records intent without pretending another process owns transport', async()=>{
  const repository=new InMemoryExtensionRepository(); const resolver=new ExtensionSourceResolver();
  resolver.register('bundled:r3',{trustState:'trusted',manifest:{kind:'mcp',id:'r3',version:'1.0.0',operations:[{operationId:'echo',permission:'mcp.tool.invoke',risk:'low',sideEffects:false,inputSchema:{type:'object',properties:{value:{type:'string'}}}}]}});
  let connects=0;
  const service=new ExtensionService({repository,sourceResolver:resolver,permissions:{check:()=>({decision:'allow'})},audit:{record:async()=>{}},runner:{connect:async()=>{connects++;return [{operationId:'echo'}];}},appAccess:async()=>true,verifyConfirmation:async()=>true});
  const subjectId=randomUUID(); const preview=await service.preview({kind:'mcp',source:'bundled:r3',subjectId,requestId:randomUUID()});
  const installed=await service.install({kind:'mcp',source:'bundled:r3',previewId:preview.previewId,previewDigest:preview.digest,confirmed:true,subjectId,requestId:randomUUID()});
  const enabled=await service.setState({kind:'mcp',id:'r3',desiredState:'enabled',subjectId,baseVersion:installed.stateVersion,requestId:randomUUID()});
  const receipt=await service.connect({id:'r3',subjectId,baseVersion:enabled.stateVersion,requestId:randomUUID(),confirmed:true});
  assert.equal(receipt.connectionState,'connecting'); assert.equal(connects,0);
});
test('audit failure keeps connection intent and terminal Run uncommitted', async()=>{
  const repository=new InMemoryExtensionRepository(); let failAction='extension.connect.start';
  const audit={record:async(event)=>{if(event.action===failAction)throw new Error('audit_unavailable');}};
  const resolver=new ExtensionSourceResolver(); resolver.register('bundled:audit',{trustState:'trusted',manifest:{kind:'mcp',id:'audit',version:'1.0.0',operations:[{operationId:'echo',permission:'mcp.tool.invoke',risk:'low',sideEffects:false,inputSchema:{type:'object',properties:{value:{type:'string'}}}}]}});
  const runner={connect:async()=>[{operationId:'echo'}],invoke:async()=>({value:'ok'})};
  const service=new ExtensionService({repository,sourceResolver:resolver,permissions:{check:()=>({decision:'allow'})},audit,runner,appAccess:async()=>true,verifyConfirmation:async()=>true});
  const subjectId=randomUUID(); const preview=await service.preview({kind:'mcp',source:'bundled:audit',subjectId,requestId:randomUUID()});
  const installed=await service.install({kind:'mcp',source:'bundled:audit',previewId:preview.previewId,previewDigest:preview.digest,confirmed:true,subjectId,requestId:randomUUID()});
  const enabled=await service.setState({kind:'mcp',id:'audit',desiredState:'enabled',subjectId,baseVersion:installed.stateVersion,requestId:randomUUID()});
  await assert.rejects(service.connect({id:'audit',subjectId,baseVersion:enabled.stateVersion,requestId:randomUUID(),confirmed:true}),/audit_unavailable/);
  assert.equal((await repository.getInstall(subjectId,'mcp','audit')).connectionState,'stopped'); assert.equal(repository.connectionIntents.size,0);
  failAction=''; const connected=await service.connect({id:'audit',subjectId,baseVersion:enabled.stateVersion,requestId:randomUUID(),confirmed:true}); await service.processConnectionIntents();
  const requestId=randomUUID(); const run=await service.submit({kind:'mcp',id:'audit',operationId:'echo',extensionVersion:'1.0.0',input:{value:'x'},subjectId,appId:'dgos.extensions',requestId,confirmationId:'ok'});
  failAction='extension.run.finish'; await assert.rejects(service.process(run.runId),/audit_unavailable/);
  assert.equal((await repository.getRun(run.runId,subjectId)).state,'running');
  assert.equal((await repository.eventsAfter(run.runId,subjectId)).length,2);
});
test('G deployment adapter requires active release, dependency, and capability',async()=>{
  const manifest={permissions:['mcp.tool.invoke'],capabilityAllowlist:['mcp.tool.invoke'],dependencies:{apps:[],skills:[{packageId:'pkg',skillId:'format',version:'1.0.0',operationIds:['run']}],mcp:[{sourceId:'same',version:'1.0.0',operationIds:['echo']}]}};
  const repo={getDeployment:async()=>({state:'active',packageId:'p',digest:'sha256:test'}),getPackageById:async()=>({digest:'sha256:test',catalogState:'official',manifest})};
  const check=createDeploymentAppAccess(repo); const input={subjectId:'s',appId:'app',kind:'mcp',extensionId:'same',extensionVersion:'1.0.0',operationId:'echo',capability:'mcp.tool.invoke'};
  assert.equal(await check(input),true); assert.equal(await check({...input,extensionId:'other'}),false);
  assert.equal(await check({...input,extensionVersion:'2.0.0'}),false);
  assert.equal(await check({...input,operationId:'other'}),false);
  assert.equal(await check({...input,kind:'skill',extensionId:'format',packageId:'pkg',operationId:'run'}),true);
  assert.equal(await check({...input,kind:'skill',extensionId:'format',packageId:'other',operationId:'run'}),false);
  assert.equal(await check({...input,capability:'secret.read'}),false);
  assert.equal(await createDeploymentAppAccess({...repo,getDeployment:async()=>({state:'uninstalled'})})(input),false);
});
test('cancel from API instance aborts handler running in another service instance',async()=>{
  const repository=new InMemoryExtensionRepository(); const resolver=new ExtensionSourceResolver(); resolver.register('bundled:cancel',{trustState:'trusted',manifest:{kind:'skill',id:'cancel',packageId:'fixture',version:'1.0.0',operations:[{operationId:'run',permission:'skill.execute',risk:'low',sideEffects:false,inputSchema:{type:'object',properties:{}}}]}});
  let aborted=false; const runner={invoke:(_input)=>new Promise((resolve,reject)=>{_input.signal.addEventListener('abort',()=>{aborted=true;reject(new Error('cancelled'));},{once:true});})};
  const make=()=>new ExtensionService({repository,sourceResolver:resolver,permissions:{check:()=>({decision:'allow'})},audit:{record:async()=>{}},runner,appAccess:async()=>true,verifyConfirmation:async()=>true});
  const api=make(),worker=make(),subjectId=randomUUID(); const preview=await api.preview({kind:'skill',source:'bundled:cancel',subjectId,requestId:randomUUID()}); const installed=await api.install({kind:'skill',source:'bundled:cancel',previewId:preview.previewId,previewDigest:preview.digest,confirmed:true,subjectId,requestId:randomUUID()}); await api.setState({kind:'skill',id:'cancel',subjectId,desiredState:'enabled',baseVersion:installed.stateVersion,requestId:randomUUID()});
  const requestId=randomUUID(); const run=await api.submit({kind:'skill',id:'cancel',operationId:'run',extensionVersion:'1.0.0',input:{},subjectId,appId:'fixture',requestId,confirmationId:'fixture'});
  const processing=worker.process(run.runId); await new Promise((resolve)=>setTimeout(resolve,20)); await api.cancel({runId:run.runId,subjectId,requestId:randomUUID()}); await processing;
  assert.equal(aborted,true); assert.equal((await api.getRun({runId:run.runId,subjectId})).state,'cancelled');
});
