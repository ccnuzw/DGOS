import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from '../../apps/api/node_modules/pg/lib/index.js';
import { PostgresExtensionRepository } from '../../src/extensions/repository.mjs';
import { PostgresExtensionManagementRepository } from '../../src/extensions/management-repository.mjs';
import { ExtensionService } from '../../src/extensions/service.mjs';
import { ExtensionManagementService } from '../../src/extensions/management-service.mjs';
import { ExtensionSourceResolver } from '../../src/extensions/source-resolver.mjs';
import { PostgresAuditRepository } from '../../src/audit/outbox.mjs';

const url=process.env.DGOS_EXTENSION_TEST_DATABASE_URL;
test('private Skill prompt stays out of mutation receipts; signed display edit preserves package identity',{skip:!url},async()=>{
  if(!/^\/(?:dgos_v1_extensions(?:_[a-z0-9]+)?|dgos_v1_verify_[0-9a-f]{32})$/.test(new URL(url).pathname))throw new Error('test database name mismatch');
  const pool=new pg.Pool({connectionString:url});
  try {
    const audit=new PostgresAuditRepository(pool);const sourceResolver=new ExtensionSourceResolver();
    const extensions=new ExtensionService({repository:new PostgresExtensionRepository(pool),audit,sourceResolver,permissions:{check:async()=>({decision:'allow'})}});
    const repository=new PostgresExtensionManagementRepository(pool,audit);
    const management=new ExtensionManagementService({extensions,repository});
    const subjectId=randomUUID(),skillId=`custom_${randomUUID().replaceAll('-','')}`;
    const requestId=randomUUID(),content={name:'My Skill',description:'Private',systemPrompt:'PRIVATE_PROMPT_NEVER_IN_MUTATIONS'};
    const created=await management.createCustom({subjectId,requestId,skillId,content,confirmed:true});
    assert.equal(created.content.systemPrompt,content.systemPrompt);
    assert.deepEqual((await management.createCustom({subjectId,requestId,skillId,content,confirmed:true})).content,content);
    const updated=await management.updateDefinition({subjectId,requestId:randomUUID(),skillId,baseVersion:1,patch:{systemPrompt:'PRIVATE_NEW_PROMPT'},confirmed:true});
    assert.equal(updated.state,'disabled');
    await assert.rejects(management.createCustom({subjectId,requestId,skillId,content,confirmed:true}),/request_conflict/);
    const rows=(await pool.query('SELECT result::text FROM extension_mutations WHERE subject_id=$1',[subjectId])).rows;
    assert.ok(rows.every((row)=>!row.result.includes('PRIVATE_')));

    const packageSkillId=`signed_${randomUUID().replaceAll('-','')}`;
    const manifest={kind:'skill',id:packageSkillId,packageId:`pkg_${randomUUID().replaceAll('-','')}`,name:'Signed',description:'Original',version:'1.0.0',operations:[{operationId:'format',permission:'skill.execute',risk:'low',sideEffects:false,inputSchema:{type:'object',properties:{text:{type:'string'}}}}]};
    const source='system:signed_management_test';sourceResolver.register(source,{manifest,trustState:'trusted'});
    const preview=await extensions.preview({kind:'skill',source,subjectId,requestId:randomUUID()});
    const installed=await extensions.install({kind:'skill',source,previewId:preview.previewId,previewDigest:preview.digest,subjectId,requestId:randomUUID(),confirmed:true});
    const renamed=await management.updateDefinition({subjectId,requestId:randomUUID(),skillId:packageSkillId,baseVersion:installed.stateVersion,patch:{name:'My Skill'}});
    assert.equal(renamed.packageId,manifest.packageId);
    assert.equal(renamed.content.name,'My Skill');
    assert.equal((await extensions.getRecord(subjectId,'skill',packageSkillId)).manifest.name,'Signed');
    await assert.rejects(management.updateDefinition({subjectId,requestId:randomUUID(),skillId:packageSkillId,baseVersion:renamed.stateVersion,patch:{systemPrompt:'wrong'},confirmed:true}),/invalid_request/);
    const longPrefix='x'.repeat(100);const left=`${longPrefix}a`;const right=`${longPrefix}b`;
    const a=await management.createCustom({subjectId,requestId:randomUUID(),skillId:left,content:{name:'Long A',description:'',systemPrompt:'A'},confirmed:true});
    const b=await management.createCustom({subjectId,requestId:randomUUID(),skillId:right,content:{name:'Long B',description:'',systemPrompt:'B'},confirmed:true});
    assert.notEqual(a.packageId,b.packageId);
  } finally {await pool.end();}
});
