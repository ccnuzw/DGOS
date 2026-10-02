import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from '../../apps/api/node_modules/pg/lib/index.js';
import { PostgresExtensionRepository } from '../../src/extensions/repository.mjs';
import { ExtensionService } from '../../src/extensions/service.mjs';
import { ExtensionSourceResolver } from '../../src/extensions/source-resolver.mjs';
import { PostgresAuditRepository } from '../../src/audit/outbox.mjs';
import { IsolatedExtensionRunner } from '../../apps/extension-runner/src/runner.mjs';
import { fileURLToPath } from 'node:url';

const url=process.env.DGOS_EXTENSION_TEST_DATABASE_URL;
test('extension registry, audit, and run survive service restart in dedicated PG', {skip:!url}, async()=>{
  if(!/^\/(?:dgos_v1_extensions(?:_[a-z0-9]+)?|dgos_v1_verify_[0-9a-f]{32})$/.test(new URL(url).pathname)) throw new Error('test database name mismatch');
  const pool=new pg.Pool({connectionString:url});
  try {
    const repository=new PostgresExtensionRepository(pool); const audit=new PostgresAuditRepository(pool);
    const sourceResolver=new ExtensionSourceResolver();
    sourceResolver.register('bundled:pg-fixture',{trustState:'trusted',manifest:{kind:'mcp',id:'pg_fixture',version:'1.0.0',operations:[{operationId:'echo',permission:'mcp.tool.invoke',risk:'low',sideEffects:false,inputSchema:{type:'object',required:['value'],properties:{value:{type:'string'}}}}]}});
    const runner={connect:async()=>[{operationId:'echo',inputSchema:{type:'object'},outputSchema:{type:'object'},permission:'mcp.tool.invoke',risk:'low',sideEffects:false}],invoke:async({input})=>({value:input.value})};
    const create=()=>new ExtensionService({repository,permissions:{check:async()=>({decision:'allow'})},audit,sourceResolver,runner,appAccess:async()=>true,verifyConfirmation:async({confirmationId,requestId})=>confirmationId===`${requestId}:test`});
    const service=create(); const subjectId=randomUUID(); const source='bundled:pg-fixture';
    const preview=await service.preview({kind:'mcp',source,subjectId,requestId:randomUUID()});
    await assert.rejects(service.install({kind:'mcp',source,previewId:preview.previewId,previewDigest:'wrong',subjectId,requestId:randomUUID(),confirmed:true}),/preview_expired/);
    const installed=await service.install({kind:'mcp',source,previewId:preview.previewId,previewDigest:preview.digest,subjectId,requestId:randomUUID(),confirmed:true});
    const enabled=await service.setState({kind:'mcp',id:'pg_fixture',desiredState:'enabled',subjectId,requestId:randomUUID(),baseVersion:installed.stateVersion});
    await service.connect({id:'pg_fixture',subjectId,requestId:randomUUID(),baseVersion:enabled.stateVersion,confirmed:true});
    await service.processConnectionIntents();
    const requestId=randomUUID(); const run=await service.submit({kind:'mcp',id:'pg_fixture',operationId:'echo',extensionVersion:'1.0.0',input:{value:'persisted'},subjectId,appId:'dgos.extensions',requestId,confirmationId:`${requestId}:test`});
    const restarted=create(); assert.equal((await restarted.getRun({runId:run.runId,subjectId})).state,'queued');
    await restarted.process(run.runId);
    assert.equal((await restarted.getRun({runId:run.runId,subjectId})).resultSummary.value,'persisted');
    const replay=await restarted.submit({kind:'mcp',id:'pg_fixture',operationId:'echo',extensionVersion:'1.0.0',input:{value:'persisted'},subjectId,appId:'dgos.extensions',requestId,confirmationId:`${requestId}:test`});
    assert.equal(replay.runId,run.runId);
    assert.equal((await restarted.events({runId:run.runId,subjectId,after:0})).items.length,3);
    const {rows}=await pool.query("SELECT count(*)::int AS n FROM audit_events WHERE request_id=$1 AND action='extension.run.accepted'",[requestId]);
    assert.equal(rows[0].n,1);
  } finally { await pool.end(); }
});

test('dedicated PG bridges API and worker instances, recovers MCP without replaying a claimed tool', {skip:!url}, async()=>{
  if(!/^\/(?:dgos_v1_extensions(?:_[a-z0-9]+)?|dgos_v1_verify_[0-9a-f]{32})$/.test(new URL(url).pathname)) throw new Error('test database name mismatch');
  const pool=new pg.Pool({connectionString:url});
  try {
    const repository=new PostgresExtensionRepository(pool); const audit=new PostgresAuditRepository(pool);
    const sourceResolver=new ExtensionSourceResolver(); sourceResolver.register('bundled:r3-pg',{trustState:'trusted',manifest:{kind:'mcp',id:'r3_pg',version:'1.0.0',operations:[{operationId:'echo',permission:'mcp.tool.invoke',risk:'low',sideEffects:false,inputSchema:{type:'object',required:['value'],properties:{value:{type:'string'}}}}]}});
    const cwd=fileURLToPath(new URL('.',import.meta.url)); const makeRunner=()=>new IsolatedExtensionRunner({runnerProfiles:{fixture:{command:process.execPath,args:[`${cwd}/stdio-mcp-fixture.mjs`],cwd}}});
    const makeService=(runner)=>new ExtensionService({repository,audit,sourceResolver,runner,permissions:{check:()=>({decision:'allow'})},appAccess:async()=>true,verifyConfirmation:async()=>true});
    const api=makeService(makeRunner()); const worker=makeService(makeRunner()); const subjectId=randomUUID();
    const preview=await api.preview({kind:'mcp',source:'bundled:r3-pg',subjectId,requestId:randomUUID()});
    const installed=await api.install({kind:'mcp',source:'bundled:r3-pg',previewId:preview.previewId,previewDigest:preview.digest,confirmed:true,subjectId,requestId:randomUUID(),config:{transport:'stdio',runnerProfileId:'fixture'}});
    const enabled=await api.setState({kind:'mcp',id:'r3_pg',desiredState:'enabled',subjectId,baseVersion:installed.stateVersion,requestId:randomUUID()});
    const receipt=await api.connect({id:'r3_pg',subjectId,baseVersion:enabled.stateVersion,confirmed:true,requestId:randomUUID()}); assert.equal(receipt.connectionState,'connecting');
    await worker.processConnectionIntents(); const connected=(await worker.list({kind:'mcp',subjectId})).items[0]; assert.equal(connected.connectionState,'connected');
    const requestId=randomUUID(); const run=await api.submit({kind:'mcp',id:'r3_pg',operationId:'echo',extensionVersion:'1.0.0',input:{value:'cross-process'},subjectId,appId:'dgos.extensions',requestId,confirmationId:'approved'});
    await worker.process(run.runId); assert.equal((await api.getRun({runId:run.runId,subjectId})).resultSummary.value,'cross-process');
    const recovering=makeService(makeRunner());
    const requestId2=randomUUID(); const second=await api.submit({kind:'mcp',id:'r3_pg',operationId:'echo',extensionVersion:'1.0.0',input:{value:'recovered'},subjectId,appId:'dgos.extensions',requestId:requestId2,confirmationId:'approved'});
    assert.equal(await recovering.process(second.runId),undefined); assert.equal((await recovering.getRun({runId:second.runId,subjectId})).state,'queued');
    await recovering.recoverConnections(); await recovering.process(second.runId);
    assert.equal((await api.getRun({runId:second.runId,subjectId})).resultSummary.value,'recovered');
    const raw=await repository.getRun(second.runId,subjectId); assert.equal(raw.handlerCalls,1);
    await worker.runner.disconnect({subjectId,kind:'mcp',extensionId:'r3_pg',version:'1.0.0',config:{transport:'stdio',runnerProfileId:'fixture'}});
    await recovering.runner.disconnect({subjectId,kind:'mcp',extensionId:'r3_pg',version:'1.0.0',config:{transport:'stdio',runnerProfileId:'fixture'}});
  } finally { await pool.end(); }
});

test('PG audit failure rolls back terminal state; secret revoke intent survives uninstall', {skip:!url}, async()=>{
  if(!/^\/(?:dgos_v1_extensions(?:_[a-z0-9]+)?|dgos_v1_verify_[0-9a-f]{32})$/.test(new URL(url).pathname)) throw new Error('test database name mismatch');
  const pool=new pg.Pool({connectionString:url});
  try {
    const repository=new PostgresExtensionRepository(pool); const realAudit=new PostgresAuditRepository(pool); let blocked='';
    const audit={record:(event,client)=>{if(event.action===blocked)throw new Error('audit_unavailable');return realAudit.record(event,client);}};
    const sourceResolver=new ExtensionSourceResolver(); sourceResolver.register('bundled:r3-audit',{trustState:'trusted',manifest:{kind:'mcp',id:'r3_audit',version:'1.0.0',requiresCredential:true,operations:[{operationId:'echo',permission:'mcp.tool.invoke',risk:'low',sideEffects:false,inputSchema:{type:'object',properties:{value:{type:'string'}}}}]}});
    let revokes=0; const secretService={inspect:async()=>({credentialState:'available'}),resolve:async()=>({read:async()=>JSON.stringify({apiKey:'fixture'})}),revoke:async()=>{revokes++;}};
    const runner={connect:async()=>[{operationId:'echo'}],invoke:async()=>({value:'ok'})};
    const service=new ExtensionService({repository,audit,sourceResolver,runner,secretService,credentialResolver:async()=>`ref-${randomUUID()}`,permissions:{check:()=>({decision:'allow'})},appAccess:async()=>true,verifyConfirmation:async()=>true});
    const subjectId=randomUUID(); const preview=await service.preview({kind:'mcp',source:'bundled:r3-audit',subjectId,requestId:randomUUID()});
    const installed=await service.install({kind:'mcp',source:'bundled:r3-audit',previewId:preview.previewId,previewDigest:preview.digest,confirmed:true,subjectId,requestId:randomUUID()});
    const enabled=await service.setState({kind:'mcp',id:'r3_audit',desiredState:'enabled',subjectId,baseVersion:installed.stateVersion,requestId:randomUUID()});
    blocked='extension.connect.start'; await assert.rejects(service.connect({id:'r3_audit',subjectId,baseVersion:enabled.stateVersion,confirmed:true,requestId:randomUUID()}),/audit_unavailable/);
    assert.equal((await repository.getInstall(subjectId,'mcp','r3_audit')).connectionState,'stopped');
    assert.equal((await repository.listConnectionIntents()).some((x)=>x.subjectId===subjectId),false);
    blocked=''; await service.connect({id:'r3_audit',subjectId,baseVersion:enabled.stateVersion,confirmed:true,requestId:randomUUID()}); await service.processConnectionIntents();
    const requestId=randomUUID(); const run=await service.submit({kind:'mcp',id:'r3_audit',operationId:'echo',extensionVersion:'1.0.0',input:{value:'x'},subjectId,appId:'dgos.extensions',requestId,confirmationId:'ok'});
    blocked='extension.run.finish'; await assert.rejects(service.process(run.runId),/audit_unavailable/);
    assert.equal((await repository.getRun(run.runId,subjectId)).state,'running');
    assert.equal((await repository.eventsAfter(run.runId,subjectId)).length,2);
    blocked=''; await repository.transitionWithAudit(run.runId,['running'],'failed',{reasonCode:'execution_uncertain'},service.auditPayload('run.finish',{subjectId,requestId,kind:'mcp',id:'r3_audit',summary:{runId:run.runId,state:'failed'},result:'failed'}),realAudit);
    const active=await repository.getInstall(subjectId,'mcp','r3_audit');
    const removed=await service.uninstall({kind:'mcp',id:'r3_audit',subjectId,baseVersion:active.stateVersion,confirmed:true,requestId:randomUUID()});
    assert.equal(removed.state,'removed'); assert.equal(revokes,0);
    const pending=await repository.listSecretRevokes(); assert.equal(pending.filter((x)=>x.subjectId===subjectId).length,1);
    await service.processSecretRevokes(); assert.ok(revokes>=1);
    assert.equal((await repository.listSecretRevokes()).filter((x)=>x.subjectId===subjectId).length,0);
  } finally { await pool.end(); }
});

test('PG confirmation binds owner, app, tool, version, digest and request', {skip:!url}, async()=>{
  if(!/^\/(?:dgos_v1_extensions(?:_[a-z0-9]+)?|dgos_v1_verify_[0-9a-f]{32})$/.test(new URL(url).pathname)) throw new Error('test database name mismatch');
  const pool=new pg.Pool({connectionString:url});
  try {
    const repository=new PostgresExtensionRepository(pool); const audit=new PostgresAuditRepository(pool); const sourceResolver=new ExtensionSourceResolver();
    sourceResolver.register('bundled:confirmation',{trustState:'trusted',manifest:{kind:'skill',id:'confirmation',packageId:'fixture_pkg',version:'1.0.0',operations:[{operationId:'run',permission:'skill.execute',risk:'high',sideEffects:true,inputSchema:{type:'object',required:['value'],properties:{value:{type:'string'}}}}]}});
    const service=new ExtensionService({repository,audit,sourceResolver,permissions:{check:()=>({decision:'allow'})},runner:{invoke:async()=>({ok:true})},appAccess:async()=>true});
    const subjectId=randomUUID(); const source='bundled:confirmation'; const preview=await service.preview({kind:'skill',source,subjectId,requestId:randomUUID()});
    const installed=await service.install({kind:'skill',source,previewId:preview.previewId,previewDigest:preview.digest,subjectId,confirmed:true,requestId:randomUUID()});
    await service.setState({kind:'skill',id:'confirmation',subjectId,desiredState:'enabled',baseVersion:installed.stateVersion,requestId:randomUUID()});
    const requestId=randomUUID(); const args={kind:'skill',id:'confirmation',operationId:'run',extensionVersion:'1.0.0',input:{value:'first'},subjectId,appId:'fixture_app',requestId};
    const ticket=await service.previewInvocation(args);
    assert.equal(ticket.executable,false);
    const issuedAgain=await service.previewInvocation(args); assert.equal(issuedAgain.confirmationId,ticket.confirmationId);
    await assert.rejects(service.previewInvocation({...args,input:{value:'changed'}}),/request_conflict/);
    await assert.rejects(service.previewInvocation({...args,appId:'other_app'}),/request_conflict/);
    assert.equal(await service.checkConfirmation({confirmationId:ticket.confirmationId,subjectId:randomUUID(),appId:'fixture_app',kind:'skill',extensionId:'confirmation',operationId:'run',extensionVersion:'1.0.0',inputDigest:ticket.inputDigest,requestId}),false);
    await assert.rejects(service.submit({...args,input:{value:'changed'},confirmationId:ticket.confirmationId}),/confirmation_required/);
    const run=await service.submit({...args,confirmationId:ticket.confirmationId}); assert.equal(run.state,'queued');
    assert.equal((await repository.getConfirmation(ticket.confirmationId,subjectId)).state,'consumed');
    const replay=await service.submit({...args,confirmationId:ticket.confirmationId});
    assert.equal(replay.runId,run.runId);
    await pool.query("UPDATE extension_confirmations SET expires_at=now()-interval '1 second' WHERE confirmation_id=$1",[ticket.confirmationId]);
    assert.equal((await service.submit({...args,confirmationId:ticket.confirmationId})).runId,run.runId);
    await assert.rejects(service.previewInvocation(args),/confirmation_expired/);
    await assert.rejects(service.submit({...args,appId:'other_app',confirmationId:ticket.confirmationId}),/request_conflict/);
    await assert.rejects(service.submit({...args,input:{value:'changed'},confirmationId:ticket.confirmationId}),/request_conflict/);
    await assert.rejects(service.submit({...args,requestId:randomUUID(),confirmationId:ticket.confirmationId}),/confirmation_required/);
  } finally { await pool.end(); }
});
