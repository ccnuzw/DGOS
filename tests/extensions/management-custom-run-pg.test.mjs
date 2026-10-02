import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from '../../apps/api/node_modules/pg/lib/index.js';
import { PostgresExtensionRepository } from '../../src/extensions/repository.mjs';
import { PostgresExtensionManagementRepository } from '../../src/extensions/management-repository.mjs';
import { ExtensionService } from '../../src/extensions/service.mjs';
import { ExtensionManagementService } from '../../src/extensions/management-service.mjs';
import { PostgresAuditRepository } from '../../src/audit/outbox.mjs';
import { ExtensionRunDaemon } from '../../apps/extension-runner/src/daemon.mjs';
import { InMemorySecretService } from '../../src/security/secret-service.mjs';

const url=process.env.DGOS_EXTENSION_TEST_DATABASE_URL;
test('custom Skill Run stores a single Task intent and resumes to terminal after worker restart',{skip:!url},async()=>{
  if(!/^\/(?:dgos_v1_extensions(?:_[a-z0-9]+)?|dgos_v1_verify_[0-9a-f]{32})$/.test(new URL(url).pathname))throw new Error('test database name mismatch');
  const pool=new pg.Pool({connectionString:url});
  try {
    const audit=new PostgresAuditRepository(pool);
    const repository=new PostgresExtensionRepository(pool);
    const managementRepository=new PostgresExtensionManagementRepository(pool,audit);
    const subjectId=randomUUID(),skillId=`custom_${randomUUID().replaceAll('-','')}`;
    let submitCalls=0,taskState='queued';const taskId=randomUUID();const requests=[];
    const aiTasks={submit:async(input)=>{submitCalls++;requests.push(input.requestId);return {taskId,status:'queued'};},get:async(id,owner)=>{assert.equal(id,taskId);assert.equal(owner,subjectId);return {taskId,status:taskState,artifactIds:taskState==='succeeded'?['artifact-fixture']:[]};},cancel:async()=>({status:'cancelled'})};
    const secretService=new InMemorySecretService();
    const makeService=()=>new ExtensionService({repository,managementRepository,audit,aiTasks,secretService,permissions:{check:async()=>({decision:'allow'})},appAccess:async()=>true});
    const api=makeService();
    const management=new ExtensionManagementService({extensions:api,repository:managementRepository});
    const created=await management.createCustom({subjectId,requestId:randomUUID(),skillId,content:{name:'Custom',description:'',systemPrompt:'Answer briefly'},confirmed:true});
    await api.setState({kind:'skill',id:skillId,subjectId,desiredState:'enabled',baseVersion:created.stateVersion,requestId:randomUUID()});
    const requestId=randomUUID();const input={text:'hello'};const options={providerConfigId:'provider',modelId:'model',parameters:{temperature:0.7}};
    const args={kind:'skill',id:skillId,operationId:'text.chat',extensionVersion:'1.0.0',input,options,subjectId,appId:'fixture_app',requestId};
    const ticket=await api.previewInvocation(args);
    await assert.rejects(api.submit({...args,options:{...options,parameters:{temperature:0.8}},confirmationId:ticket.confirmationId}),/confirmation_required/);
    const run=await api.submit({...args,confirmationId:ticket.confirmationId});assert.equal(run.state,'queued');
    const workerA=makeService();await workerA.process(run.runId);
    assert.equal((await api.getRun({runId:run.runId,subjectId})).state,'running');
    const intent=await managementRepository.taskIntent(run.runId);
    assert.equal(intent.task_id,taskId);assert.equal(requests[0],intent.task_request_id);
    taskState='succeeded';const workerB=makeService();
    const daemon=new ExtensionRunDaemon({service:workerB,maxConcurrent:2});await daemon.tick();
    const finished=await api.getRun({runId:run.runId,subjectId});
    assert.equal(finished.state,'succeeded');assert.equal(finished.taskId,taskId);assert.equal(submitCalls,1);
    const replay=await api.submit({...args,input:{text:'hello'},options:{parameters:{temperature:0.7},modelId:'model',providerConfigId:'provider'},confirmationId:ticket.confirmationId});assert.equal(replay.runId,run.runId);
  } finally {await pool.end();}
});
