import { randomUUID } from 'node:crypto';
import { digest, invalid, requireId, requireRequestId, validateInput, validateManifest, validateConfig, assertPlain } from './validation.mjs';
import { normalizeRequestParameters } from '../provider-config/text-parameters.mjs';
import { createPublicKey, verify } from 'node:crypto';
import { canonicalJson } from '../apps/package-service.mjs';

const publicRecord = (x) => ({ id:x.id, kind:x.kind, state:x.state, version:x.version, ...(x.packageId?{packageId:x.packageId}:{}), connectionState:x.connectionState, ...(x.connectionAttemptId?{connectionAttemptId:x.connectionAttemptId}:{}), credentialStatus:x.credentialRef ? 'configured' : x.manifest.requiresCredential ? 'missing' : 'not_required', toolCount:x.connectionState === 'connected' ? x.toolCatalog.length : 0, stateVersion:x.stateVersion });
const terminal = new Set(['succeeded','failed','timed_out','cancelled']);
function textOptions(options) {
  if(!options||typeof options!=='object'||Array.isArray(options)||Object.keys(options).some((key)=>!['providerConfigId','modelId','parameters'].includes(key))||typeof options.providerConfigId!=='string'||!options.providerConfigId||typeof options.modelId!=='string'||!options.modelId)throw invalid();
  return {...options,parameters:normalizeRequestParameters(options.parameters)};
}

export class ExtensionService {
  constructor({ repository, permissions, audit, secretService, sourceResolver, runner, references = async () => [], appAccess, verifyConfirmation, credentialResolver, managementRepository, aiTasks, clock = () => Date.now() }) {
    Object.assign(this, { repository, permissions, audit, secretService, sourceResolver, runner, references, appAccess, verifyConfirmation, credentialResolver, managementRepository, aiTasks, clock });
    this.active = new Map();
  }
  async authorize({ subjectId, appId, capability, scope = '*', declared = [], requestId, confirmed = false }) {
    const result = await this.permissions.check({ subjectId, appId, capability, scope, declared, requestId });
    if (result.decision === 'deny') throw invalid('permission_denied', 403);
    if ((result.decision === 'ask' && !confirmed) || (confirmed !== true && capability.endsWith('.execute'))) throw invalid('confirmation_required', 409);
    return result;
  }
  async auditEvent(action, { subjectId, requestId, kind, id, summary = {}, result = 'succeeded', client }) { await this.audit.record({ requestId, actorId:subjectId, action:`extension.${action}`, targetType:kind, targetId:id, result, summary }, client); }
  auditPayload(action,{subjectId,requestId,kind,id,summary={},result='succeeded'}) { return {requestId,actorId:subjectId,action:`extension.${action}`,targetType:kind,targetId:id,result,summary}; }
  async transitionAudited(run,from,state,patch,action='run.finish') { return this.repository.transitionWithAudit(run.runId,from,state,patch,this.auditPayload(action,{subjectId:run.subjectId,requestId:run.requestId,kind:run.kind,id:run.extensionId,summary:{runId:run.runId,state,handlerCalls:run.handlerCalls??0},result:state==='succeeded'?'succeeded':'failed'}),this.audit); }
  async preview({ kind, source, subjectId, appId = 'dgos.extensions', requestId }) {
    requireRequestId(requestId);
    if (!['skill','mcp'].includes(kind) || typeof source !== 'string' || (!source.startsWith('https://')&&!/^(registry|bundled|system|local):[a-z0-9_./-]{1,256}$/.test(source)) || source.includes('..')) throw invalid();
    await this.authorize({ subjectId, appId, capability:`${kind}.install`, declared:[`${kind}.install`], requestId });
    const resolved = await this.sourceResolver.resolve({ kind, source });
    if (!resolved || !['trusted','untrusted'].includes(resolved.trustState)) throw invalid('source_unavailable', 422);
    const manifest = validateManifest(resolved.manifest, kind);
    const value = { previewId:randomUUID(), subjectId, requestId, kind, sourceRef:source, manifest, digest:digest(manifest), trustState:resolved.trustState, expiresAt:new Date(this.clock()+15*60_000).toISOString() };
    const saved = resolved.envelope ? await this.managementRepository?.saveOnlinePreview(value,resolved.sourceDigest,resolved.envelope) : await this.repository.savePreview(value);
    if(!saved)throw invalid('source_unavailable',503);
    await this.auditEvent('preview', { subjectId, requestId, kind, id:manifest.id, summary:{ manifestDigest:saved.digest, trustState:saved.trustState } });
    return { requestId, previewId:saved.previewId, kind, digest:saved.digest, trustState:saved.trustState==='trusted'?'verified':'rejected', expiresAt:saved.expiresAt, summary:{ id:manifest.id, packageId:manifest.packageId, version:manifest.version, permissions:manifest.operations.map((o)=>o.permission), childSkillIds:manifest.childSkillIds??[], risks:manifest.operations.map((o)=>o.risk) } };
  }
  async install({ kind, previewId, previewDigest, source, subjectId, appId = 'dgos.extensions', requestId, confirmed, config = {}, templateId, templateVersion, credentials, secureTransport }) {
    requireRequestId(requestId);
    await this.authorize({ subjectId, appId, capability:`${kind}.install`, declared:[`${kind}.install`], requestId, confirmed });
    if (confirmed !== true) throw invalid('confirmation_required',409);
    const preview = await this.repository.getPreview(previewId, subjectId);
    if (!preview || preview.kind !== kind || preview.sourceRef !== source || preview.digest !== previewDigest || Date.parse(preview.expiresAt) <= this.clock()) throw invalid('preview_expired',409);
    if (preview.trustState !== 'trusted') throw invalid('source_untrusted',403);
    if(source.startsWith('https://')) {
      const stored=await this.managementRepository?.onlineBytes(previewId);
      if(typeof stored?.envelope?._rawBytes!=='string')throw invalid('source_changed',409);
      const raw=Buffer.from(stored.envelope._rawBytes,'base64');let envelope;
      try{envelope=JSON.parse(raw.toString('utf8'));}catch{throw invalid('source_changed',409);}
      const root=this.sourceResolver.onlinePolicy?.trustRoots?.get(envelope.keyId);
      if(digest(stored.envelope._rawBytes)!==stored.source_digest||digest(envelope.manifest)!==preview.digest||digest(preview.manifest)!==preview.digest||!root||!verify(null,Buffer.from(canonicalJson(envelope.manifest)),root.type==='public'?root:createPublicKey(root),Buffer.from(envelope.signature,'base64')))throw invalid('source_changed',409);
    }
    validateConfig(config,preview.manifest);
    let template;
    if(templateId!==undefined||templateVersion!==undefined||credentials!==undefined) {
      if(kind!=='mcp'||!templateId||!templateVersion||!this.management?.templates)throw invalid();
      template=this.management.templates.find((item)=>item.templateId===templateId&&item.version===templateVersion&&item.source===source&&digest(item.config)===digest(config));
      if(!template)throw invalid('invalid_request',422);
      const fields=template.credentialFields.map((field)=>field.name);
      if(credentials!==undefined&&(!secureTransport||!credentials||typeof credentials!=='object'||Array.isArray(credentials)||!Object.keys(credentials).length||Object.keys(credentials).length>16||Object.keys(credentials).some((field)=>!fields.includes(field))||Object.values(credentials).some((value)=>typeof value!=='string'||!value||value.length>8192)))throw invalid();
      if(template.credentialFields.some((field)=>field.required&&!credentials?.[field.name]))throw invalid('credential_unavailable',409);
    }
    const credentialFingerprint=credentials?this.management?.credentialFingerprint?.(credentials):null;
    if(credentials&&!credentialFingerprint)throw invalid('secret_unavailable',503);
    const fp=digest({kind,previewId,config,templateId,templateVersion,credentialFingerprint});
    const replay=await this.managementRepository?.replayInstall({subjectId,requestId,fingerprint:fp});
    if(replay)return replay;
    const intentId=credentials?randomUUID():null;
    const secretRef=intentId?`mcp-credential:${subjectId}:${preview.manifest.id}:${intentId}`:null;
    if(intentId)await this.managementRepository.prepareSecret({intentId,subjectId,extensionId:preview.manifest.id,secretRef,oldSecretRef:null,requestId,credentialFingerprint});
    try{return await this.repository.mutation(subjectId,requestId,'install',fp,async(c)=>{
      if(intentId){const locked=await c.query("SELECT state FROM extension_secret_write_intents WHERE intent_id=$1 FOR UPDATE",[intentId]);if(locked.rows[0]?.state!=='prepared')throw invalid('secret_unavailable',503);await this.secretService.put({secretRef,value:JSON.stringify(credentials),purpose:'mcp-credential',subjectId,ttlMs:365*24*60*60*1000});}
      const credentialRef=preview.manifest.requiresCredential ? await this.credentialResolver?.({subjectId,kind,extensionId:preview.manifest.id,config}) : null;
      const effectiveRef=secretRef??credentialRef;
      if(preview.manifest.requiresCredential&&!effectiveRef&&!source.startsWith('bundled:'))throw invalid('credential_unavailable',409);
      const record={ subjectId,kind,id:preview.manifest.id,packageId:preview.manifest.packageId,version:preview.manifest.version,sourceRef:source,manifestDigest:preview.digest,manifest:preview.manifest,state:'installed',connectionState:preview.manifest.requiresCredential&&!effectiveRef?'needs-credentials':'stopped',config,credentialRef:effectiveRef??null,toolCatalog:[],stateVersion:1 };
      if (record.credentialRef) await this.checkCredential(record);
      const saved=await this.repository.putInstall(record,c);
      await this.auditEvent('install',{subjectId,requestId,kind,id:record.id,summary:{version:record.version,manifestDigest:record.manifestDigest},client:c});
      if(intentId)await c.query("UPDATE extension_secret_write_intents SET state='committed',completed_at=now() WHERE intent_id=$1",[intentId]);
      return publicRecord(saved);
    });}catch(error){if(intentId)await this.managementRepository.recoverSecretWrites(this.secretService,{intentId});throw error;}
  }
  async checkCredential(record) {
    if (!record.manifest.requiresCredential) return;
    if (!record.credentialRef || typeof record.credentialRef !== 'string' || !this.secretService) throw invalid('credential_unavailable',409);
    const status=await this.secretService.inspect(record.credentialRef);
    if (status.credentialState!=='available') throw invalid('credential_unavailable',409);
  }
  async connectionCredentials(record) {
    if(!record.credentialRef)return null;
    await this.checkCredential(record);
    if(!this.secretService?.resolve)throw invalid('credential_unavailable',409);
    const handle=await this.secretService.resolve({secretRef:record.credentialRef,purpose:'mcp-credential',subjectId:record.subjectId});
    let credentials;try{credentials=JSON.parse(await handle.read());}catch{throw invalid('credential_unavailable',409);}
    if(!credentials||typeof credentials!=='object'||Array.isArray(credentials)||Object.values(credentials).some((value)=>typeof value!=='string'))throw invalid('credential_unavailable',409);
    return credentials;
  }
  async list({ kind, subjectId, appId='dgos.extensions', requestId }) { await this.authorize({subjectId,appId,capability:`${kind}.read`,declared:[`${kind}.read`],requestId}); return {items:(await this.repository.list(subjectId,kind)).map(publicRecord)}; }
  async getRecord(subjectId,kind,id) { const record=await this.repository.getInstall(subjectId,kind,requireId(id)); if(!record||record.state==='removed') throw invalid('extension_not_found',404); return record; }
  async setState({ kind,id,desiredState,subjectId,appId='dgos.extensions',requestId,baseVersion,confirmed=false }) {
    requireRequestId(requestId);
    await this.authorize({subjectId,appId,capability:`${kind}.manage`,declared:[`${kind}.manage`],requestId,confirmed});
    if(!['enabled','disabled','configured','disconnected'].includes(desiredState)) throw invalid();
    if(desiredState==='disconnected') return this.disconnect({id,subjectId,appId,requestId,baseVersion});
    return this.repository.mutation(subjectId,requestId,'state',digest({kind,id,desiredState,baseVersion}),async(c)=>{
      const old=await this.getRecord(subjectId,kind,id);
      if(baseVersion!=null&&old.stateVersion!==Number(baseVersion)) throw invalid('version_conflict',409);
      if(desiredState==='disabled'&&await this.hasActiveRuns(subjectId,kind,id)) throw invalid('extension_in_use',409);
      if(desiredState==='configured'&&kind!=='mcp') throw invalid();
      const next=await this.repository.updateInstall(subjectId,kind,id,old.stateVersion,{state:desiredState==='configured'?old.state:desiredState,connectionState:desiredState==='disabled'?'stopped':old.connectionState,toolCatalog:desiredState==='disabled'?[]:old.toolCatalog},c);
      if(!next) throw invalid('version_conflict',409);
      await this.auditEvent('state',{subjectId,requestId,kind,id,summary:{from:old.state,to:desiredState},client:c});
      return publicRecord(next);
    });
  }
  async hasActiveRuns(subjectId,kind,id) { return (await this.repository.listRunnable()).some((r)=>r.subjectId===subjectId&&r.kind===kind&&r.extensionId===id); }
  async uninstall({kind,id,subjectId,appId='dgos.extensions',requestId,baseVersion,confirmed=false}) {
    requireRequestId(requestId); await this.authorize({subjectId,appId,capability:`${kind}.uninstall`,declared:[`${kind}.uninstall`],requestId,confirmed});
    if(!confirmed) throw invalid('confirmation_required',409);
    return this.repository.mutation(subjectId,requestId,'uninstall',digest({kind,id,baseVersion}),async(c)=>{
      const old=await this.getRecord(subjectId,kind,id);
      if(old.stateVersion!==Number(baseVersion)) throw invalid('version_conflict',409);
      const refs=await this.references({subjectId,kind,id});
      if(refs.length||await this.hasActiveRuns(subjectId,kind,id)) throw invalid('extension_in_use',409);
      const next=await this.repository.updateInstall(subjectId,kind,id,old.stateVersion,{state:'removed',connectionState:'stopped',toolCatalog:[],credentialRef:null},c);
      if(!next) throw invalid('version_conflict',409);
      await this.auditEvent('uninstall',{subjectId,requestId,kind,id,summary:{version:old.version},client:c});
      if(old.credentialRef) await this.repository.queueSecretRevoke({intentId:randomUUID(),subjectId,kind,extensionId:id,secretRef:old.credentialRef},c);
      return publicRecord(next);
    });
  }
  async connect({id,subjectId,appId='dgos.extensions',requestId,baseVersion,confirmed=false}) {
    requireRequestId(requestId); await this.authorize({subjectId,appId,capability:'mcp.connect',declared:['mcp.connect'],requestId,confirmed});
    if(!confirmed) throw invalid('confirmation_required',409);
    const old=await this.getRecord(subjectId,'mcp',id);
    if (old.connectionState==='connecting'||old.connectionState==='connected') return publicRecord(old);
    if (!Number.isSafeInteger(baseVersion)||baseVersion<1||old.stateVersion!==baseVersion) throw invalid('version_conflict',409);
    if(old.state!=='enabled') throw invalid('extension_disabled',409);
    await this.checkCredential(old);
    const attemptId=randomUUID();
    const intent={intentId:attemptId,subjectId,kind:'mcp',extensionId:id,extensionVersion:old.version,configDigest:digest(old.config),action:'connect',requestId};
    let connecting;
    try { connecting=await this.repository.updateConnectionWithAudit(subjectId,'mcp',id,old.stateVersion,{connectionState:'connecting',connectionAttemptId:attemptId},intent,this.auditPayload('connect.start',{subjectId,requestId,kind:'mcp',id,summary:{attemptId}}),this.audit); }
    catch(error) { if(error.message!=='version_conflict') throw error; }
    if(!connecting) return publicRecord(await this.getRecord(subjectId,'mcp',id));
    return publicRecord(connecting);
  }
  async disconnect({id,subjectId,appId='dgos.extensions',requestId,baseVersion}) {
    requireRequestId(requestId); await this.authorize({subjectId,appId,capability:'mcp.connect',declared:['mcp.connect'],requestId});
    const old=await this.getRecord(subjectId,'mcp',id);
    if (!Number.isSafeInteger(baseVersion)||baseVersion<1||old.stateVersion!==baseVersion) throw invalid('version_conflict',409);
    if (await this.hasActiveRuns(subjectId,'mcp',id)) throw invalid('extension_in_use',409);
    if (old.connectionState==='stopped') return publicRecord(old);
    const intentId=randomUUID();
    const intent={intentId,subjectId,kind:'mcp',extensionId:id,extensionVersion:old.version,configDigest:digest(old.config),action:'disconnect',requestId};
    const next=await this.repository.updateConnectionWithAudit(subjectId,'mcp',id,old.stateVersion,{connectionState:'stopping',connectionAttemptId:intentId},intent,this.auditPayload('disconnect.start',{subjectId,requestId,kind:'mcp',id,summary:{from:old.connectionState,intentId}}),this.audit);
    return publicRecord(next);
  }
  async tools({id,subjectId,appId='dgos.extensions',requestId}) { await this.authorize({subjectId,appId,capability:'mcp.read',declared:['mcp.read'],requestId}); const x=await this.getRecord(subjectId,'mcp',id); return {sourceId:id,catalogVersion:x.stateVersion,items:x.connectionState==='connected'?x.toolCatalog:[]}; }
  async discover({id,subjectId,appId='dgos.extensions',requestId,baseVersion}) {
    requireRequestId(requestId); await this.authorize({subjectId,appId,capability:'mcp.read',declared:['mcp.read'],requestId});
    const x=await this.getRecord(subjectId,'mcp',id);
    if (x.stateVersion!==baseVersion||x.connectionState!=='connected') throw invalid('version_conflict',409);
    return this.tools({id,subjectId,appId,requestId});
  }
  async processConnectionIntents(workerId='extension-worker') {
    for(const intent of await this.repository.listConnectionIntents()) {
      if(this.repository.claimConnectionIntent && !await this.repository.claimConnectionIntent(intent.intentId,workerId)) continue;
      const record=await this.repository.getInstall(intent.subjectId,intent.kind,intent.extensionId);
      if(!record||record.version!==intent.extensionVersion||digest(record.config)!==intent.configDigest||record.connectionAttemptId!==intent.intentId) { await this.repository.finishConnectionIntent(intent.intentId,'failed'); continue; }
      const binding={subjectId:intent.subjectId,kind:intent.kind,extensionId:intent.extensionId,version:intent.extensionVersion,config:record.config};
      try {
        let patch;
        if(intent.action==='disconnect') { await this.runner.disconnect(binding); patch={connectionState:'stopped',toolCatalog:[]}; }
        else {
          await this.checkCredential(record);
          const tools=await this.runner.connect({...binding,credentials:await this.connectionCredentials(record)});
          const declared=new Map(record.manifest.operations.map((o)=>[o.operationId,o]));
          if(tools.some((t)=>!declared.has(t.operationId??t.name))) throw invalid('tool_catalog_invalid',502);
          const catalog=tools.map((t)=>{const op=declared.get(t.operationId??t.name);return {operationId:op.operationId,inputSchema:op.inputSchema,outputSchema:op.outputSchema??{type:'object'},permission:op.permission,risk:op.risk,sideEffects:op.sideEffects};});
          patch={connectionState:'connected',toolCatalog:catalog};
        }
        await this.repository.finishConnectionWithAudit(intent.subjectId,intent.kind,intent.extensionId,record.stateVersion,patch,intent.intentId,this.auditPayload(intent.action==='connect'?'connect.finish':'disconnect.finish',{subjectId:intent.subjectId,requestId:intent.requestId,kind:intent.kind,id:intent.extensionId,summary:{intentId:intent.intentId,toolCount:patch.toolCatalog.length}}),this.audit);
      } catch(error) {
        if(!['credential_unavailable','connection_failed','tool_catalog_invalid','runner_profile_unavailable','timeout','mcp_protocol_error','handler_unavailable'].includes(error.message)) throw error;
        const current=await this.repository.getInstall(intent.subjectId,intent.kind,intent.extensionId);
        if(current?.connectionAttemptId===intent.intentId) await this.repository.updateConnectionWithAudit(intent.subjectId,intent.kind,intent.extensionId,current.stateVersion,{connectionState:'failed',toolCatalog:[]},null,this.auditPayload('connect.fail',{subjectId:intent.subjectId,requestId:intent.requestId,kind:intent.kind,id:intent.extensionId,summary:{intentId:intent.intentId,reasonCode:error.message},result:'failed'}),this.audit);
        await this.repository.finishConnectionIntent(intent.intentId,'failed');
      }
    }
  }
  async recoverConnections() {
    const runs=await this.repository.listRunnable();
    for(const run of runs.filter((r)=>r.state==='queued'&&r.kind==='mcp')) {
      const record=await this.repository.getInstall(run.subjectId,'mcp',run.extensionId);
      if(!record||record.connectionState!=='connected'||!record.config?.transport) continue;
      const binding={subjectId:run.subjectId,kind:'mcp',extensionId:run.extensionId,version:record.version,config:record.config};
      if(this.runner.hasConnection(binding)) continue;
      try { await this.checkCredential(record); await this.runner.connect({...binding,credentials:await this.connectionCredentials(record)}); }
      catch { await this.repository.updateConnectionWithAudit(run.subjectId,'mcp',run.extensionId,record.stateVersion,{connectionState:'failed',toolCatalog:[]},null,this.auditPayload('connect.recovery_failed',{subjectId:run.subjectId,requestId:run.requestId,kind:'mcp',id:run.extensionId,summary:{reasonCode:'connection_not_ready'},result:'failed'}),this.audit); }
    }
  }
  async processSecretRevokes() { for(const intent of await this.repository.listSecretRevokes()) { await this.secretService.revoke(intent.secretRef); await this.repository.finishSecretRevoke(intent.intentId); } }
  async previewInvocation({kind,id,operationId,extensionVersion,input,options,subjectId,appId,requestId}) {
    requireRequestId(requestId); requireId(appId); requireId(operationId);
    const record=await this.getRecord(subjectId,kind,id);
    if(record.version!==extensionVersion||record.state!=='enabled'||(kind==='mcp'&&record.connectionState!=='connected')) throw invalid('connection_not_ready',409);
    const op=record.manifest.operations.find((item)=>item.operationId===operationId);
    if(!op) throw invalid('operation_not_found',404);
    validateInput(op.inputSchema,input);
    const custom=record.sourceRef.startsWith('local:');
    if(custom&&!options||!custom&&options)throw invalid();
    if(custom)options=textOptions(options);
    const definition=custom?await this.managementRepository?.definition(subjectId,id):null;
    if(custom&&!definition)throw invalid('extension_not_found',404);
    const inputDigest=custom?digest({input,options,definitionVersion:record.stateVersion,contentDigest:definition.contentDigest}):digest(input);
    if(!this.appAccess||!await this.appAccess({subjectId,appId,kind,extensionId:id,packageId:record.packageId,operationId,extensionVersion,capability:op.permission})) throw invalid('permission_denied',403);
    await this.authorize({subjectId,appId,capability:op.permission,scope:`${kind}:${id}:${operationId}`,declared:[op.permission],requestId,confirmed:true});
    const ticket=await this.repository.createConfirmation({confirmationId:randomUUID(),subjectId,appId,kind,extensionId:id,operationId,extensionVersion,inputDigest,requestId,state:'approved',expiresAt:new Date(this.clock()+5*60_000).toISOString()});
    await this.auditEvent('run.confirm',{subjectId,requestId,kind,id,summary:{operationId,inputDigest:ticket.inputDigest,risk:op.risk,sideEffects:op.sideEffects}});
    return {confirmationId:ticket.confirmationId,requestId,appId,kind,extensionId:id,operationId,extensionVersion,inputDigest:ticket.inputDigest,expiresAt:ticket.expiresAt,executable:false};
  }
  async approveInvocation({confirmationId,subjectId,requestId}) { requireRequestId(requestId); const ticket=await this.repository.getConfirmation(confirmationId,subjectId); if(!ticket||ticket.requestId!==requestId)throw invalid('confirmation_not_found',404); const approved=await this.repository.approveConfirmation(confirmationId,subjectId); if(!approved)throw invalid('confirmation_expired',409); await this.auditEvent('run.confirm',{subjectId,requestId,kind:ticket.kind,id:ticket.extensionId,summary:{confirmationId}}); return {confirmationId,requestId,state:'approved',expiresAt:approved.expiresAt}; }
  async checkConfirmation({confirmationId,subjectId,appId,kind,extensionId,operationId,extensionVersion,inputDigest,requestId}) { if(!/^[0-9a-f-]{36}$/i.test(confirmationId??''))return false; const x=await this.repository.getConfirmation(confirmationId,subjectId); return Boolean(x&&x.state==='approved'&&Date.parse(x.expiresAt)>this.clock()&&x.appId===appId&&x.kind===kind&&x.extensionId===extensionId&&x.operationId===operationId&&x.extensionVersion===extensionVersion&&x.inputDigest===inputDigest&&x.requestId===requestId); }
  async submit({kind,id,operationId,extensionVersion,input,options,subjectId,appId,requestId,confirmationId,timeoutMs=15000}) {
    requireRequestId(requestId); requireId(appId); requireId(operationId);
    const existing=await this.repository.getRunByRequest(subjectId,requestId);
    if(existing) {
      const priorIntent=await this.managementRepository?.taskIntent(existing.runId);
      const replayDigest=priorIntent?digest({input,options,definitionVersion:Number(priorIntent.definition_version),contentDigest:priorIntent.content_digest}):digest(input);
      if(existing.appId!==appId||existing.kind!==kind||existing.extensionId!==id||existing.operationId!==operationId||existing.extensionVersion!==extensionVersion||existing.inputDigest!==replayDigest) throw invalid('request_conflict',409);
      if(confirmationId&&/^[0-9a-f-]{36}$/i.test(confirmationId)) {
        const ticket=await this.repository.getConfirmation(confirmationId,subjectId);
        if(!ticket||ticket.requestId!==requestId||ticket.appId!==appId||ticket.kind!==kind||ticket.extensionId!==id||ticket.operationId!==operationId||ticket.extensionVersion!==extensionVersion||ticket.inputDigest!==existing.inputDigest||ticket.state!=='consumed') throw invalid('request_conflict',409);
      }
      return this.publicRun(existing);
    }
    const record=await this.getRecord(subjectId,kind,id);
    if (record.version!==extensionVersion) throw invalid('version_conflict',409);
    if(record.state!=='enabled') throw invalid('extension_disabled',409);
    if(kind==='mcp'&&record.connectionState!=='connected') throw invalid('connection_not_ready',409);
    const op=record.manifest.operations.find((o)=>o.operationId===operationId);
    if(!op || (kind==='mcp'&&!record.toolCatalog.some((t)=>t.operationId===operationId))) throw invalid('operation_not_found',404);
    validateInput(op.inputSchema,input);
    const custom=record.sourceRef.startsWith('local:');if(custom&&!options||!custom&&options)throw invalid();
    if(custom)options=textOptions(options);
    const definition=custom?await this.managementRepository?.definition(subjectId,id):null;if(custom&&!definition)throw invalid('extension_not_found',404);
    const inputDigest=custom?digest({input,options,definitionVersion:record.stateVersion,contentDigest:definition.contentDigest}):digest(input);
    if (!this.appAccess || !await this.appAccess({subjectId,appId,kind,extensionId:id,packageId:record.packageId,operationId,extensionVersion,capability:op.permission})) throw invalid('permission_denied',403);
    const confirmation={confirmationId,subjectId,appId,kind,extensionId:id,operationId,extensionVersion,inputDigest,requestId};
    const confirmed = Boolean(confirmationId && (await this.checkConfirmation(confirmation) || this.verifyConfirmation && await this.verifyConfirmation(confirmation)));
    await this.authorize({subjectId,appId,capability:op.permission,scope:`${kind}:${id}:${operationId}`,declared:[op.permission],requestId,confirmed});
    if((op.sideEffects||op.risk==='high')&&!confirmed) throw invalid('confirmation_required',409);
    await this.checkCredential(record);
    if(!Number.isSafeInteger(timeoutMs)||timeoutMs<100||timeoutMs>60000) throw invalid();
    const useTicket=Boolean(confirmationId&&await this.checkConfirmation(confirmation));
    if(custom&&!useTicket)throw invalid('confirmation_required',409);
    const taskIntent=custom?{definitionVersion:record.stateVersion,contentDigest:definition.contentDigest,taskRequestId:randomUUID(),taskInput:`${definition.content.systemPrompt}\n\n${input.text}`,options}:null;
    const payload={runId:randomUUID(),requestId,subjectId,appId,kind,extensionId:id,operationId,extensionVersion:record.version,manifestDigest:record.manifestDigest,inputDigest,input,timeoutAt:new Date(this.clock()+timeoutMs).toISOString(),taskIntent};
    const callback=async(created,client)=>this.auditEvent('run.accepted',{subjectId,requestId,kind,id,summary:{runId:created.runId,operationId,inputDigest:created.inputDigest,version:record.version},client});
    const {run}=useTicket?await this.repository.createRunWithConfirmation(payload,confirmationId,callback):await this.repository.createRun(payload,callback);
    return this.publicRun(run);
  }
  publicRun(r) { return {runId:r.runId,requestId:r.requestId,kind:r.kind,extensionId:r.extensionId,operationId:r.operationId,extensionVersion:r.extensionVersion,state:r.state,sequence:r.sequence,...(r.reasonCode?{reasonCode:r.reasonCode}:{}),...(r.resultSummary?{resultSummary:r.resultSummary}:{}),...(r.taskId?{taskId:r.taskId}:{})}; }
  async getRun({runId,subjectId}) { const r=await this.repository.getRun(runId,subjectId); if(!r) throw invalid('run_not_found',404); return this.publicRun(r); }
  async cancel({runId,subjectId,requestId}) {
    requireRequestId(requestId); const r=await this.repository.getRun(runId,subjectId); if(!r) throw invalid('run_not_found',404);
    if(terminal.has(r.state)) return this.publicRun(r);
    const next=await this.transitionAudited(r,[r.state],r.state==='queued'?'cancelled':'cancel_requested',{reasonCode:'cancelled'},'run.cancel');
    if(r.taskId) await this.aiTasks?.cancel(r.taskId,subjectId,requestId);
    this.active.get(runId)?.abort();
    return this.publicRun(next??await this.repository.getRun(runId,subjectId));
  }
  async events({runId,subjectId,after=0}) { const items=await this.repository.eventsAfter(runId,subjectId,after); if(!items) throw invalid('run_not_found',404); return {items}; }
  async process(runId,workerId='extension-worker') {
    const pending=(await this.repository.listRunnable()).find((r)=>r.runId===runId);
    if(!pending) return undefined;
    const priorTaskIntent=await this.managementRepository?.taskIntent(runId);
    if(pending.state==='cancel_requested') {
      if(priorTaskIntent?.task_id){
        await this.aiTasks?.cancel(priorTaskIntent.task_id,pending.subjectId,pending.requestId);
        return this.processCustomTask(pending,priorTaskIntent);
      }
      return this.transitionAudited(pending,['cancel_requested'],'cancelled',{reasonCode:'cancelled'});
    }
    if(pending.state==='running') return priorTaskIntent?this.processCustomTask(pending,priorTaskIntent):undefined; // Existing external handlers are never resent.
    if(Date.parse(pending.timeoutAt)<=this.clock()) return this.transitionAudited(pending,['queued'],'timed_out',{reasonCode:'timeout'});
    const record=await this.getRecord(pending.subjectId,pending.kind,pending.extensionId);
    const op=record.manifest.operations.find((o)=>o.operationId===pending.operationId);
    if(!op||record.version!==pending.extensionVersion||record.state!=='enabled'||(pending.kind==='mcp'&&record.connectionState!=='connected')) return this.transitionAudited(pending,['queued'],'failed',{reasonCode:'dependency_changed'});
    try { if(!this.appAccess || !await this.appAccess({subjectId:pending.subjectId,appId:pending.appId,kind:pending.kind,extensionId:pending.extensionId,packageId:record.packageId,operationId:pending.operationId,extensionVersion:pending.extensionVersion,capability:op.permission})) throw invalid('permission_denied',403); await this.authorize({subjectId:pending.subjectId,appId:pending.appId,capability:op.permission,scope:`${pending.kind}:${pending.extensionId}:${pending.operationId}`,declared:[op.permission],requestId:pending.requestId,confirmed:true}); await this.checkCredential(record); }
    catch { return this.transitionAudited(pending,['queued'],'failed',{reasonCode:'permission_denied'}); }
    if(pending.kind==='mcp'&&record.config?.transport&&!this.runner.hasConnection?.({subjectId:pending.subjectId,kind:pending.kind,extensionId:pending.extensionId,version:pending.extensionVersion,config:record.config})) return undefined;
    const claimed=await this.repository.claim(runId,workerId,65000); if(!claimed) return undefined;
    const taskIntent=priorTaskIntent;
    if(taskIntent) {
      return this.processCustomTask(claimed,taskIntent);
    }
    const controller=new AbortController(); this.active.set(runId,controller);
    const cancellationPoll=setInterval(()=>{ this.repository.getRun(runId,claimed.subjectId).then((current)=>{if(current?.state==='cancel_requested')controller.abort();}).catch(()=>{}); },50);
    let result; let handlerError;
    try { result=await this.runner.invoke({subjectId:claimed.subjectId,kind:claimed.kind,extensionId:claimed.extensionId,version:claimed.extensionVersion,operationId:claimed.operationId,input:claimed.input,signal:controller.signal,timeoutMs:Math.max(1,Date.parse(claimed.timeoutAt)-this.clock()),config:record.config}); if(result==null||typeof result!=='object'||Array.isArray(result)) throw invalid('handler_failed',502); assertPlain(result); }
    catch(error) { handlerError=error; }
    finally { clearInterval(cancellationPoll); this.active.delete(runId); }
    const latest=await this.repository.getRun(runId,claimed.subjectId);
    const state=latest.state==='cancel_requested'||handlerError?.message==='cancelled'?'cancelled':handlerError?.message==='timeout'?'timed_out':handlerError?'failed':'succeeded';
    return this.transitionAudited(latest,[latest.state],state,state==='succeeded'?{resultSummary:result}:{reasonCode:state==='failed'?'handler_failed':state});
  }
  async processCustomTask(run,intent) {
    if(!this.aiTasks?.submit||!this.aiTasks?.get)return this.transitionAudited(run,['running'],'failed',{reasonCode:'task_unavailable'});
    if(run.state==='cancel_requested'&&!intent.task_id)return this.transitionAudited(run,['cancel_requested'],'cancelled',{reasonCode:'cancelled'});
    let taskId=intent.task_id;
    if(!taskId) {
      try {const receipt=await this.aiTasks.submit({ownerId:run.subjectId,requestId:intent.task_request_id,target:'extension.skill.run',intent:'text.chat',input:{text:intent.task_input},options:intent.options});taskId=receipt.taskId;await this.managementRepository.bindTask(run.runId,taskId);}
      catch(error) {if(error.message==='quota_exceeded'||error.message==='model_not_allowed')return this.transitionAudited(run,['running'],'failed',{reasonCode:error.message});throw error;}
    }
    const task=await this.aiTasks.get(taskId,run.subjectId);
    if(!['succeeded','failed','cancelled','timed_out'].includes(task.status))return undefined;
    const state=run.state==='cancel_requested'?'cancelled':task.status==='succeeded'?'succeeded':task.status==='cancelled'?'cancelled':task.status==='timed_out'?'timed_out':'failed';
    return this.transitionAudited(run,['running','cancel_requested'],state,state==='succeeded'?{resultSummary:{taskId,artifactIds:task.artifactIds??[]}}:{reasonCode:task.error?.errorKey??state});
  }
  async reconcile() { for(const r of await this.repository.listRunnable()) { const custom=await this.managementRepository?.taskIntent(r.runId); if(custom)continue; if(r.state==='running'&&r.handlerClaimed&&r.leaseUntil&&Date.parse(r.leaseUntil)<=this.clock()) await this.transitionAudited(r,['running'],'failed',{reasonCode:'execution_uncertain'}); else if(r.state==='cancel_requested'&&r.leaseUntil&&Date.parse(r.leaseUntil)<=this.clock()) await this.transitionAudited(r,['cancel_requested'],'failed',{reasonCode:'execution_uncertain'}); else if(r.state==='queued'&&Date.parse(r.timeoutAt)<=this.clock()) await this.transitionAudited(r,['queued'],'timed_out',{reasonCode:'timeout'}); } }
}
