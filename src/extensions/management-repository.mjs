import { randomUUID } from 'node:crypto';
import { invalid } from './validation.mjs';

export class PostgresExtensionManagementRepository {
  constructor(pool,audit) { this.pool=pool; this.audit=audit; }
  async tx(work) { const c=await this.pool.connect(); try { await c.query('BEGIN'); const result=await work(c); await c.query('COMMIT'); return result; } catch(error) { await c.query('ROLLBACK'); throw error; } finally { c.release(); } }
  definitionRow(r) { return r&&({subjectId:r.subject_id,skillId:r.skill_id,packageId:r.package_id,sourceType:r.source_type,content:r.content,contentDigest:r.content_digest,localizedDisplay:r.localized_display}); }
  async definition(subjectId,skillId,client=this.pool) { const {rows}=await client.query('SELECT * FROM extension_skill_definitions WHERE subject_id=$1 AND skill_id=$2',[subjectId,skillId]); return this.definitionRow(rows[0]); }
  async ensureDefinition(record) {
    const existing=await this.definition(record.subjectId,record.id);if(existing)return existing;
    const content={name:typeof record.manifest.name==='string'?record.manifest.name:record.id,description:record.manifest.description??'',systemPrompt:''};
    await this.pool.query("INSERT INTO extension_skill_definitions(subject_id,skill_id,package_id,source_type,content,content_digest) VALUES($1,$2,$3,'package',$4,$5) ON CONFLICT(subject_id,skill_id) DO NOTHING",[record.subjectId,record.id,record.packageId,JSON.stringify(content),record.manifestDigest]);
    return this.definition(record.subjectId,record.id);
  }
  async createCustom({subjectId,requestId,skillId,packageId,content,contentDigest,install,receipt,event}) { return this.tx(async(c)=>{
    await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`${subjectId}:${requestId}`]);
    const prior=await c.query('SELECT operation,fingerprint,result FROM extension_mutations WHERE subject_id=$1 AND request_id=$2',[subjectId,requestId]);
    if(prior.rows[0]) { if(prior.rows[0].operation!=='custom.create'||prior.rows[0].fingerprint!==contentDigest)throw invalid('request_conflict',409); const definition=await this.definition(subjectId,skillId,c); if(definition?.contentDigest!==prior.rows[0].result.contentDigest)throw invalid('request_conflict',409); return {...prior.rows[0].result,content:definition.content}; }
    const old=await c.query("SELECT 1 FROM extension_installs WHERE subject_id=$1 AND kind='skill' AND extension_id=$2 AND state<>'removed'",[subjectId,skillId]); if(old.rows[0])throw invalid('extension_conflict',409);
    await c.query('INSERT INTO extension_skill_definitions(subject_id,skill_id,package_id,source_type,content,content_digest) VALUES($1,$2,$3,$4,$5,$6)',[subjectId,skillId,packageId,'custom',JSON.stringify(content),contentDigest]);
    await c.query("INSERT INTO extension_installs(subject_id,kind,extension_id,package_id,version,source_ref,manifest_digest,manifest,state,connection_state,config,tool_catalog) VALUES($1,'skill',$2,$3,'1.0.0',$4,$5,$6,'installed','stopped','{}','[]')",[subjectId,skillId,packageId,install.sourceRef,install.manifestDigest,JSON.stringify(install.manifest)]);
    await this.audit.record(event,c);
    const {content:privateContent,...publicReceipt}=receipt;
    await c.query('INSERT INTO extension_mutations(subject_id,request_id,operation,fingerprint,result) VALUES($1,$2,$3,$4,$5)',[subjectId,requestId,'custom.create',contentDigest,JSON.stringify(publicReceipt)]);
    return receipt;
  }); }
  async updateDefinition({subjectId,skillId,baseVersion,requestId,fingerprint,patch,disable,event}) { return this.tx(async(c)=>{
    await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`${subjectId}:${requestId}`]);
    const prior=await c.query('SELECT operation,fingerprint,result FROM extension_mutations WHERE subject_id=$1 AND request_id=$2',[subjectId,requestId]);
    if(prior.rows[0]) { if(prior.rows[0].operation!=='skill.definition'||prior.rows[0].fingerprint!==fingerprint)throw invalid('request_conflict',409); const definition=await this.definition(subjectId,skillId,c); if(definition?.contentDigest!==prior.rows[0].result.contentDigest)throw invalid('request_conflict',409); return {...prior.rows[0].result,content:definition.content}; }
    const install=await c.query("SELECT * FROM extension_installs WHERE subject_id=$1 AND kind='skill' AND extension_id=$2 AND state<>'removed' FOR UPDATE",[subjectId,skillId]);
    if(!install.rows[0])throw invalid('extension_not_found',404); if(Number(install.rows[0].state_version)!==baseVersion)throw invalid('version_conflict',409);
    let current=await this.definition(subjectId,skillId,c);
    if(!current) {
      const manifest=install.rows[0].manifest;
      const content={name:typeof manifest.name==='string'?manifest.name:skillId,description:manifest.description??'',systemPrompt:''};
      current={subjectId,skillId,packageId:install.rows[0].package_id,sourceType:'package',content,contentDigest:install.rows[0].manifest_digest,localizedDisplay:{}};
      await c.query('INSERT INTO extension_skill_definitions(subject_id,skill_id,package_id,source_type,content,content_digest) VALUES($1,$2,$3,$4,$5,$6)',[subjectId,skillId,current.packageId,'package',JSON.stringify(content),current.contentDigest]);
    }
    const next=patch(current); await c.query('UPDATE extension_skill_definitions SET content=$3,content_digest=$4,localized_display=$5,updated_at=now() WHERE subject_id=$1 AND skill_id=$2',[subjectId,skillId,JSON.stringify(next.content),next.contentDigest,JSON.stringify(next.localizedDisplay)]);
    const changed=await c.query("UPDATE extension_installs SET state=CASE WHEN $3 THEN 'disabled' ELSE state END,state_version=state_version+1,updated_at=now() WHERE subject_id=$1 AND kind='skill' AND extension_id=$2 RETURNING state,state_version,package_id,version",[subjectId,skillId,disable]);
    const receipt={skillId,packageId:changed.rows[0].package_id,version:changed.rows[0].version,stateVersion:Number(changed.rows[0].state_version),sourceType:current.sourceType,state:changed.rows[0].state,content:next.content,contentDigest:next.contentDigest,localizedDisplay:next.localizedDisplay};
    await this.audit.record(event,c);
    const {content:privateContent,...publicReceipt}=receipt;
    await c.query('INSERT INTO extension_mutations(subject_id,request_id,operation,fingerprint,result) VALUES($1,$2,$3,$4,$5)',[subjectId,requestId,'skill.definition',fingerprint,JSON.stringify(publicReceipt)]);
    return receipt;
  }); }
  async saveTranslation(x) { return this.tx(async(c)=>{ await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`${x.subjectId}:${x.requestId}`]); const prior=await c.query('SELECT * FROM extension_translation_intents WHERE subject_id=$1 AND request_id=$2',[x.subjectId,x.requestId]); if(prior.rows[0]) {if(prior.rows[0].intent_digest!==x.intentDigest)throw invalid('request_conflict',409);return prior.rows[0];} const {rows}=await c.query('INSERT INTO extension_translation_intents(subject_id,request_id,skill_id,source_version,source_digest,target_locale,fields,options,intent_digest,task_input) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',[x.subjectId,x.requestId,x.skillId,x.sourceVersion,x.sourceDigest,x.targetLocale,JSON.stringify(x.fields),JSON.stringify(x.options),x.intentDigest,x.taskInput]); return rows[0]; }); }
  async translationByRequest(subjectId,requestId) { const {rows}=await this.pool.query('SELECT * FROM extension_translation_intents WHERE subject_id=$1 AND request_id=$2',[subjectId,requestId]); return rows[0]; }
  async bindTranslation(subjectId,requestId,taskId) { await this.pool.query('UPDATE extension_translation_intents SET task_id=$3 WHERE subject_id=$1 AND request_id=$2 AND (task_id IS NULL OR task_id=$3)',[subjectId,requestId,taskId]); }
  async translationByTask(subjectId,taskId) { const {rows}=await this.pool.query('SELECT * FROM extension_translation_intents WHERE subject_id=$1 AND task_id=$2',[subjectId,taskId]); return rows[0]; }
  async taskIntent(runId) { const {rows}=await this.pool.query('SELECT * FROM extension_task_intents WHERE run_id=$1',[runId]); return rows[0]; }
  async bindTask(runId,taskId) { await this.pool.query('UPDATE extension_task_intents SET task_id=$2 WHERE run_id=$1 AND (task_id IS NULL OR task_id=$2)',[runId,taskId]); await this.pool.query('UPDATE extension_runs SET task_id=$2 WHERE run_id=$1 AND (task_id IS NULL OR task_id=$2)',[runId,taskId]); }
  async saveOnlineBytes(previewId,sourceDigest,envelope) { await this.pool.query('INSERT INTO extension_online_preview_bytes(preview_id,source_digest,envelope) VALUES($1,$2,$3)',[previewId,sourceDigest,JSON.stringify(envelope)]); }
  async saveOnlinePreview(preview,sourceDigest,envelope) { return this.tx(async(c)=>{
    const {rows}=await c.query('INSERT INTO extension_previews(preview_id,subject_id,request_id,kind,source_ref,digest,manifest,trust_state,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(subject_id,request_id) DO UPDATE SET request_id=EXCLUDED.request_id RETURNING *',[preview.previewId,preview.subjectId,preview.requestId,preview.kind,preview.sourceRef,preview.digest,JSON.stringify(preview.manifest),preview.trustState,preview.expiresAt]);
    const row=rows[0];
    if(row.preview_id!==preview.previewId) { if(row.source_ref!==preview.sourceRef||row.digest!==preview.digest)throw invalid('request_conflict',409); }
    else await c.query('INSERT INTO extension_online_preview_bytes(preview_id,source_digest,envelope) VALUES($1,$2,$3)',[preview.previewId,sourceDigest,JSON.stringify(envelope)]);
    return {previewId:row.preview_id,subjectId:row.subject_id,requestId:row.request_id,kind:row.kind,sourceRef:row.source_ref,digest:row.digest,manifest:row.manifest,trustState:row.trust_state,expiresAt:row.expires_at.toISOString()};
  }); }
  async onlineBytes(previewId) { const {rows}=await this.pool.query('SELECT * FROM extension_online_preview_bytes WHERE preview_id=$1',[previewId]); return rows[0]; }
  async prepareSecret(x) {
    const {rows}=await this.pool.query("INSERT INTO extension_secret_write_intents(intent_id,subject_id,kind,extension_id,secret_ref,old_secret_ref,request_id,credential_digest,credential_key_version,state) VALUES($1,$2,'mcp',$3,$4,$5,$6,$7,$8,'prepared') ON CONFLICT(subject_id,request_id) DO UPDATE SET intent_id=EXCLUDED.intent_id,secret_ref=EXCLUDED.secret_ref,old_secret_ref=EXCLUDED.old_secret_ref,state='prepared',created_at=now(),completed_at=NULL WHERE extension_secret_write_intents.state='revoked' AND extension_secret_write_intents.extension_id=EXCLUDED.extension_id AND extension_secret_write_intents.credential_digest=EXCLUDED.credential_digest AND extension_secret_write_intents.credential_key_version=EXCLUDED.credential_key_version RETURNING intent_id",[x.intentId,x.subjectId,x.extensionId,x.secretRef,x.oldSecretRef,x.requestId,x.credentialFingerprint.digest,x.credentialFingerprint.keyVersion]);
    if(!rows[0])throw invalid('request_conflict',409);
  }
  async finishSecret(intentId,state) { await this.pool.query('UPDATE extension_secret_write_intents SET state=$2,completed_at=now() WHERE intent_id=$1',[intentId,state]); }
  async replayMcpConfig({subjectId,requestId,fingerprint}) {
    const prior=await this.pool.query('SELECT operation,fingerprint,result FROM extension_mutations WHERE subject_id=$1 AND request_id=$2',[subjectId,requestId]);
    if(!prior.rows[0])return null;
    if(prior.rows[0].operation!=='mcp.config'||prior.rows[0].fingerprint!==fingerprint)throw invalid('request_conflict',409);
    return prior.rows[0].result;
  }
  async replayInstall({subjectId,requestId,fingerprint}) {
    const {rows}=await this.pool.query('SELECT operation,fingerprint,result FROM extension_mutations WHERE subject_id=$1 AND request_id=$2',[subjectId,requestId]);
    if(!rows[0])return null;
    if(rows[0].operation!=='install'||rows[0].fingerprint!==fingerprint)throw invalid('request_conflict',409);
    return rows[0].result;
  }
  async updateMcpConfig({subjectId,requestId,id,baseVersion,config,credentials,credentialFingerprint,record,secretService,fingerprint,audit}) {
    const prior=await this.replayMcpConfig({subjectId,requestId,fingerprint});
    if(prior)return prior;
    const intentId=credentials?randomUUID():null;
    const secretRef=credentials?`mcp-credential:${subjectId}:${id}:${intentId}`:record.credentialRef;
    if(credentials) {
      if(!secretService?.put||!secretService?.revoke)throw invalid('secret_unavailable',503);
      await this.prepareSecret({intentId,subjectId,extensionId:id,secretRef,oldSecretRef:record.credentialRef,requestId,credentialFingerprint});
    }
    try {return await this.tx(async(c)=>{
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`${subjectId}:${requestId}`]);
      if(intentId) {
        const locked=await c.query("SELECT state FROM extension_secret_write_intents WHERE intent_id=$1 FOR UPDATE",[intentId]);
        if(locked.rows[0]?.state!=='prepared')throw invalid('secret_unavailable',503);
        await secretService.put({secretRef,value:JSON.stringify(credentials),purpose:'mcp-credential',subjectId,ttlMs:365*24*60*60*1000});
      }
      const replay=await c.query('SELECT operation,fingerprint,result FROM extension_mutations WHERE subject_id=$1 AND request_id=$2',[subjectId,requestId]);
      if(replay.rows[0]) {if(replay.rows[0].operation!=='mcp.config'||replay.rows[0].fingerprint!==fingerprint)throw invalid('request_conflict',409);return replay.rows[0].result;}
      const {rows}=await c.query("UPDATE extension_installs SET config=$4,credential_ref=$5,connection_state=$6,tool_catalog='[]'::jsonb,state_version=state_version+1,updated_at=now() WHERE subject_id=$1 AND kind='mcp' AND extension_id=$2 AND state_version=$3 AND connection_state IN ('stopped','failed','needs-credentials') RETURNING state,state_version,version,manifest",[subjectId,id,baseVersion,JSON.stringify(config),secretRef,secretRef?'stopped':'needs-credentials']);
      if(!rows[0])throw invalid('version_conflict',409);
      await audit.record({requestId,actorId:subjectId,action:'extension.mcp.config',targetType:'mcp',targetId:id,summary:{stateVersion:Number(rows[0].state_version),credentialStatus:secretRef?'configured':'missing'}},c);
      const result={id,kind:'mcp',state:rows[0].state,version:rows[0].version,stateVersion:Number(rows[0].state_version),connectionState:secretRef?'stopped':'needs-credentials',credentialStatus:secretRef?'configured':'missing',toolCount:0};
      await c.query('INSERT INTO extension_mutations(subject_id,request_id,operation,fingerprint,result) VALUES($1,$2,$3,$4,$5)',[subjectId,requestId,'mcp.config',fingerprint,JSON.stringify(result)]);
      if(intentId) {await c.query("UPDATE extension_secret_write_intents SET state='committed',completed_at=now() WHERE intent_id=$1",[intentId]);if(record.credentialRef)await c.query("INSERT INTO extension_secret_revoke_intents(intent_id,subject_id,kind,extension_id,secret_ref,state) VALUES($1,$2,'mcp',$3,$4,'pending')",[randomUUID(),subjectId,id,record.credentialRef]);}
      return result;
    });}
    catch(error) {if(intentId)await this.recoverSecretWrites(secretService,{intentId});throw error;}
  }
  async recoverSecretWrites(secretService,{intentId}={}) {
    if(!secretService?.revoke)throw invalid('secret_unavailable',503);
    let count=0;
    while(count<100) {
      const recovered=await this.tx(async(c)=>{
        const {rows}=await c.query(`SELECT * FROM extension_secret_write_intents WHERE state='prepared' ${intentId?'AND intent_id=$1':''} ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED`,intentId?[intentId]:[]);
        if(!rows[0])return false;
        await secretService.revoke(rows[0].secret_ref);
        await c.query("UPDATE extension_secret_write_intents SET state='revoked',completed_at=now() WHERE intent_id=$1",[rows[0].intent_id]);
        return true;
      });
      if(!recovered)break;
      count++;
      if(intentId)break;
    }
    return count;
  }
}
