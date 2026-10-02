import { randomUUID } from 'node:crypto';
import { digest, invalid, requireId, requireRequestId, validateConfig } from './validation.mjs';
import { normalizeRequestParameters } from '../provider-config/text-parameters.mjs';

const fields=new Set(['name','description','systemPrompt']);
const locales=new Set(['zh-CN','en-US']);
const contentLimit={name:128,description:4096,systemPrompt:16384};
const own=(value,allowed)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every((key)=>allowed.includes(key));
function checkContent(content,partial=false) {
  if(!own(content,[...fields])||!partial&&[...fields].some((key)=>!Object.hasOwn(content,key))||partial&&!Object.keys(content).length)throw invalid();
  for(const [key,value] of Object.entries(content))if(typeof value!=='string'||value.length>contentLimit[key]||(key!=='description'&&!value.trim()))throw invalid();
  return content;
}
const detail=(record,definition)=>({skillId:record.id,packageId:record.packageId,version:record.version,stateVersion:record.stateVersion,sourceType:definition.sourceType,state:record.state,content:definition.content,contentDigest:definition.contentDigest,localizedDisplay:definition.localizedDisplay});
const event=(subjectId,requestId,action,id,summary={})=>({requestId,actorId:subjectId,action:`extension.${action}`,targetType:'skill',targetId:id,summary});
export class ExtensionManagementService {
  constructor({extensions,repository,aiTasks,templates=[],secretService,credentialFingerprint,clock=()=>Date.now()}) { Object.assign(this,{extensions,repository,aiTasks,templates,secretService,credentialFingerprint,clock}); }
  async createCustom({subjectId,requestId,skillId,content,confirmed}) {
    requireRequestId(requestId);requireId(skillId);checkContent(content);if(confirmed!==true)throw invalid('confirmation_required',428);
    await this.extensions.authorize({subjectId,appId:'dgos.extensions',capability:'skill.install',requestId,confirmed:true});
    const packageId=`local_${digest(subjectId).slice(0,16)}_${skillId.slice(0,80)}_${digest(skillId).slice(0,16)}`;
    const manifest={kind:'skill',id:skillId,packageId,childSkillIds:[skillId],version:'1.0.0',operations:[{operationId:'text.chat',permission:'skill.execute',risk:'medium',sideEffects:false,inputSchema:{type:'object',required:['text'],properties:{text:{type:'string'}}},outputSchema:{type:'object'}}]};
    const contentDigest=digest({skillId,content});const sourceRef=`local:${packageId}`;
    const receipt={skillId,packageId,version:'1.0.0',stateVersion:1,sourceType:'custom',state:'installed',content,contentDigest,localizedDisplay:{}};
    return this.repository.createCustom({subjectId,requestId,skillId,packageId,content,contentDigest,install:{sourceRef,manifestDigest:digest(manifest),manifest},receipt,event:event(subjectId,requestId,'skill.custom.create',skillId,{contentDigest})});
  }
  async definition({subjectId,skillId,requestId}) {
    await this.extensions.authorize({subjectId,appId:'dgos.extensions',capability:'skill.read',requestId});
    const record=await this.extensions.getRecord(subjectId,'skill',skillId);
    let definition=await this.repository.definition(subjectId,skillId);
    if(!definition) {const name=record.manifest.name??skillId;definition={sourceType:'package',content:{name:typeof name==='string'?name:skillId,description:record.manifest.description??'',systemPrompt:''},contentDigest:record.manifestDigest,localizedDisplay:{}};}
    await this.extensions.auditEvent('skill.definition.read',{subjectId,requestId,kind:'skill',id:skillId,summary:{stateVersion:record.stateVersion}});
    return detail(record,definition);
  }
  async updateDefinition({subjectId,requestId,skillId,baseVersion,patch,confirmed=false}) {
    requireRequestId(requestId);requireId(skillId);checkContent(patch,true);
    if(!Number.isSafeInteger(baseVersion)||baseVersion<1)throw invalid();
    await this.extensions.authorize({subjectId,appId:'dgos.extensions',capability:'skill.manage',requestId,confirmed});
    const record=await this.extensions.getRecord(subjectId,'skill',skillId);
    if(Object.hasOwn(patch,'systemPrompt')&&record.sourceRef.startsWith('local:')===false)throw invalid('invalid_request',422);
    if(Object.hasOwn(patch,'systemPrompt')&&confirmed!==true)throw invalid('confirmation_required',428);
    const fingerprint=digest({skillId,baseVersion,patch});
    return this.repository.updateDefinition({subjectId,skillId,baseVersion,requestId,fingerprint,disable:Object.hasOwn(patch,'systemPrompt'),patch:(current)=>{const content={...current.content,...patch};return {content,contentDigest:digest(content),localizedDisplay:current.localizedDisplay};},event:event(subjectId,requestId,'skill.definition.update',skillId,{fields:Object.keys(patch)})});
  }
  async translate({subjectId,requestId,skillId,baseVersion,targetLocale,fields:selected,options,confirmed}) {
    requireRequestId(requestId);requireId(skillId);if(confirmed!==true)throw invalid('confirmation_required',428);
    if(!locales.has(targetLocale)||!Array.isArray(selected)||!selected.length||new Set(selected).size!==selected.length||selected.some((field)=>!fields.has(field))||!own(options,['providerConfigId','modelId','parameters'])||typeof options.providerConfigId!=='string'||!options.providerConfigId||typeof options.modelId!=='string'||!options.modelId)throw invalid();
    options={...options,parameters:normalizeRequestParameters(options.parameters)};
    await this.extensions.authorize({subjectId,appId:'dgos.extensions',capability:'skill.manage',requestId,confirmed:true});
    const prior=await this.repository.translationByRequest(subjectId,requestId);
    if(prior) {
      const replayDigest=digest({skillId,baseVersion,contentDigest:prior.source_digest,targetLocale,fields:selected,options});
      if(prior.intent_digest!==replayDigest)throw invalid('request_conflict',409);
      if(!this.aiTasks?.submit)throw invalid('task_unavailable',503);
      const receipt=await this.aiTasks.submit({ownerId:subjectId,requestId,target:'extension.skill.translation',intent:'text.chat',input:{text:prior.task_input},options});
      await this.repository.bindTranslation(subjectId,requestId,receipt.taskId);return receipt;
    }
    const record=await this.extensions.getRecord(subjectId,'skill',skillId);const definition=await this.repository.ensureDefinition(record);
    if(!definition)throw invalid('extension_not_found',404);if(record.stateVersion!==baseVersion)throw invalid('version_conflict',409);
    const source=Object.fromEntries(selected.map((field)=>[field,definition.content[field]]));
    const taskInput=`Translate the JSON object to ${targetLocale}. Return only a JSON object with exactly the same keys.\n${JSON.stringify(source)}`;
    const intentDigest=digest({skillId,baseVersion,contentDigest:definition.contentDigest,targetLocale,fields:selected,options});
    const intent=await this.repository.saveTranslation({subjectId,requestId,skillId,sourceVersion:baseVersion,sourceDigest:definition.contentDigest,targetLocale,fields:selected,options,intentDigest,taskInput});
    if(!this.aiTasks?.submit)throw invalid('task_unavailable',503);
    const receipt=await this.aiTasks.submit({ownerId:subjectId,requestId,target:'extension.skill.translation',intent:'text.chat',input:{text:intent.task_input},options});
    await this.repository.bindTranslation(subjectId,requestId,receipt.taskId);return receipt;
  }
  async applyTranslation({subjectId,requestId,skillId,baseVersion,taskId,artifactId,confirmed}) {
    requireRequestId(requestId);if(confirmed!==true)throw invalid('confirmation_required',428);
    await this.extensions.authorize({subjectId,appId:'dgos.extensions',capability:'skill.manage',requestId,confirmed:true});
    const intent=await this.repository.translationByTask(subjectId,taskId);if(!intent||intent.skill_id!==skillId)throw invalid('translation_not_found',404);
    const task=await this.aiTasks?.get(taskId,subjectId);if(task?.status!=='succeeded'||!task.artifactIds?.includes(artifactId))throw invalid('translation_not_ready',409);
    const artifact=await this.aiTasks.artifact(artifactId,subjectId);let translated;try{translated=JSON.parse(artifact.content);}catch{throw invalid('translation_invalid',422);}
    const selected=intent.fields;if(!own(translated,selected)||Object.keys(translated).length!==selected.length||selected.some((field)=>!Object.hasOwn(translated,field)))throw invalid('translation_invalid',422);
    try{checkContent(translated,true);}catch{throw invalid('translation_invalid',422);}
    const record=await this.extensions.getRecord(subjectId,'skill',skillId);const definition=await this.repository.definition(subjectId,skillId);
    if(record.stateVersion!==baseVersion||baseVersion!==Number(intent.source_version)||definition?.contentDigest!==intent.source_digest)throw invalid('version_conflict',409);
    const promptChanged=selected.includes('systemPrompt')&&definition.sourceType==='custom';
    const fingerprint=digest({skillId,baseVersion,taskId,artifactId});
    return this.repository.updateDefinition({subjectId,skillId,baseVersion,requestId,fingerprint,disable:promptChanged,patch:(current)=>{
      const content=promptChanged?{...current.content,systemPrompt:translated.systemPrompt}:current.content;
      const localizedDisplay={...current.localizedDisplay,[intent.target_locale]:{name:translated.name??current.content.name,description:translated.description??current.content.description}};
      return {content,contentDigest:digest(content),localizedDisplay};
    },event:event(subjectId,requestId,'skill.translation.apply',skillId,{taskId,fields:selected,targetLocale:intent.target_locale})});
  }
  async listTemplates({subjectId,requestId}) { await this.extensions.authorize({subjectId,appId:'dgos.extensions',capability:'mcp.read',requestId});return {items:this.templates.map(({templateId,version,source,name,config,credentialFields})=>({templateId,version,source,name,setupState:credentialFields.some((field)=>field.required)?'needs-credentials':'ready',config,credentialFields}))}; }
  async updateMcpConfig({subjectId,requestId,id,baseVersion,config,credentials,confirmed,secureTransport}) {
    requireRequestId(requestId);if(confirmed!==true)throw invalid('confirmation_required',428);
    await this.extensions.authorize({subjectId,appId:'dgos.extensions',capability:'mcp.manage',requestId,confirmed:true});
    if(credentials!==undefined&&(!secureTransport||!own(credentials,Object.keys(credentials))||!Object.keys(credentials).length||Object.keys(credentials).length>16||Object.values(credentials).some((value)=>typeof value!=='string'||!value||value.length>8192)))throw invalid();
    if(credentials&&!this.credentialFingerprint)throw invalid('secret_unavailable',503);
    const credentialFingerprint=credentials?this.credentialFingerprint(credentials):null;
    const fingerprint=digest({id,baseVersion,config,credentialFingerprint});
    const replay=await this.repository.replayMcpConfig({subjectId,requestId,fingerprint});
    if(replay)return replay;
    const record=await this.extensions.getRecord(subjectId,'mcp',id);
    if(record.stateVersion!==baseVersion||!['stopped','needs-credentials','failed'].includes(record.connectionState)||await this.extensions.hasActiveRuns(subjectId,'mcp',id))throw invalid('version_conflict',409);
    validateConfig(config,record.manifest);
    const template=this.templates.find((item)=>item.source===record.sourceRef&&digest(item.config)===digest(config));if(!template)throw invalid('invalid_request',422);
    if(credentials!==undefined&&!own(credentials,template.credentialFields.map((field)=>field.name)))throw invalid();
    const required=template.credentialFields.filter((field)=>field.required).map((field)=>field.name);
    if(record.manifest.requiresCredential&&!record.credentialRef&&required.some((field)=>!credentials?.[field]))throw invalid('credential_unavailable',409);
    return this.repository.updateMcpConfig({subjectId,requestId,id,baseVersion,config,credentials,credentialFingerprint,record,secretService:this.secretService,fingerprint,audit:this.extensions.audit});
  }
}
