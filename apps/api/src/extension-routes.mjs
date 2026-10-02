import { InMemoryExtensionRepository, PostgresExtensionRepository } from '../../../src/extensions/repository.mjs';
import { ExtensionService } from '../../../src/extensions/service.mjs';
import { IsolatedExtensionRunner } from '../../extension-runner/src/runner.mjs';
import { invalid } from '../../../src/extensions/validation.mjs';
import { PostgresExtensionManagementRepository } from '../../../src/extensions/management-repository.mjs';
import { ExtensionManagementService } from '../../../src/extensions/management-service.mjs';

function body(r, keys) {
  const value=r.body;
  if(!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).some((key)=>!keys.includes(key))) throw invalid();
  return value;
}

// Lead calls this from buildServer after auth/CSRF/broker/audit are available.
export function registerExtensionRoutes(app, { pool, repository = pool ? new PostgresExtensionRepository(pool) : new InMemoryExtensionRepository(), permissions, audit, secretService, sourceResolver, runner = new IsolatedExtensionRunner(), requireScope, validateCsrf, references, appAccess, verifyConfirmation, credentialResolver, aiTasks, managementRepository = pool ? new PostgresExtensionManagementRepository(pool,audit) : undefined, templates = [], credentialFingerprint, trustedTransport, allowInsecureFixture = false } = {}) {
  const service = new ExtensionService({ repository, permissions, audit, secretService, sourceResolver, runner, references, appAccess, verifyConfirmation, credentialResolver, managementRepository, aiTasks });
  const management=managementRepository?new ExtensionManagementService({extensions:service,repository:managementRepository,aiTasks,templates,secretService,credentialFingerprint}):null;
  const auth = async (request, scope, write = false) => { if (write) await validateCsrf(request); return requireScope(request, scope); };
  const requestId = (r) => r.body?.requestId ?? r.requestId;
  app.post('/api/v1/extensions/previews', async (r) => { const input=body(r,['requestId','kind','source','version']); const kind=input.kind; if(!['skill','mcp'].includes(kind)) throw invalid(); const a=await auth(r,`${kind}.install`,true); return service.preview({...input,kind,subjectId:a.subjectId,requestId:requestId(r)}); });
  for (const [segment, kind, key] of [['skills','skill','skillId'],['mcp','mcp','mcpId']]) {
    const root = `/api/v1/${segment}`;
    app.get(root, async (r) => { const a = await auth(r, `${kind}.read`); return service.list({ kind, subjectId:a.subjectId, requestId:r.requestId }); });
    app.post(root, async (r, reply) => { const input=body(r,['requestId','source','version','previewId','previewDigest','confirmed','config','templateId','templateVersion','credentials']); const a = await auth(r, `${kind}.install`, true); const secureTransport=Boolean(await trustedTransport?.(r))||allowInsecureFixture===true&&process.env.NODE_ENV!=='production'; return reply.code(202).send(await service.install({ ...input, kind, subjectId:a.subjectId, requestId:requestId(r),secureTransport })); });
    app.post(`${root}/:${key}/state`, async (r) => { const input=body(r,['requestId','baseVersion','desiredState','config']); const a = await auth(r, `${kind}.manage`, true); return service.setState({ ...input, kind, id:r.params[key], subjectId:a.subjectId, requestId:requestId(r) }); });
    app.delete(`${root}/:${key}`, async (r, reply) => { const input=body(r,['requestId','baseVersion','confirmed']); const a = await auth(r, `${kind}.uninstall`, true); return reply.code(202).send(await service.uninstall({ ...input, kind, id:r.params[key], subjectId:a.subjectId, requestId:requestId(r) })); });
  }
  app.post('/api/v1/mcp/:mcpId/connect', async (r, reply) => { const input=body(r,['requestId','baseVersion']); const a = await auth(r, 'mcp.connect', true); return reply.code(202).send(await service.connect({ ...input, id:r.params.mcpId, subjectId:a.subjectId, requestId:requestId(r), confirmed:true })); });
  app.post('/api/v1/mcp/:mcpId/disconnect', async (r, reply) => { const input=body(r,['requestId','baseVersion']); const a = await auth(r, 'mcp.connect', true); return reply.code(202).send(await service.disconnect({ ...input, id:r.params.mcpId, subjectId:a.subjectId, requestId:requestId(r) })); });
  app.get('/api/v1/mcp/:mcpId/tools', async (r) => { const a = await auth(r, 'mcp.read'); return service.tools({ id:r.params.mcpId, subjectId:a.subjectId, requestId:r.requestId }); });
  app.post('/api/v1/mcp/:mcpId/tools', async (r) => { const input=body(r,['requestId','baseVersion']); const a = await auth(r, 'mcp.read', true); return service.discover({ ...input, id:r.params.mcpId, subjectId:a.subjectId, requestId:requestId(r) }); });
  app.post('/api/v1/extensions/runs', async (r, reply) => { const input=body(r,['requestId','appId','kind','extensionId','operationId','extensionVersion','input','options','confirmationId']); const kind=input.kind; if(!['skill','mcp'].includes(kind)) throw invalid(); const a=await auth(r,`${kind}.execute`,true); return reply.code(202).send(await service.submit({ ...input,kind,id:input.extensionId,subjectId:a.subjectId,requestId:requestId(r) })); });
  app.post('/api/v1/extensions/confirmations', async(r,reply)=>{ const input=body(r,['requestId','appId','kind','extensionId','operationId','extensionVersion','input','options']); const kind=input.kind; if(!['skill','mcp'].includes(kind))throw invalid(); const a=await auth(r,`${kind}.execute`,true); return reply.code(201).send(await service.previewInvocation({...input,id:input.extensionId,subjectId:a.subjectId,requestId:requestId(r)})); });
  app.get('/api/v1/extensions/runs/:runId', async (r) => { const a = await auth(r, 'extension.run.read'); return service.getRun({runId:r.params.runId,subjectId:a.subjectId}); });
  app.get('/api/v1/extensions/runs/:runId/events', async (r,reply) => { const a = await auth(r, 'extension.run.read'); const {items}=await service.events({runId:r.params.runId,subjectId:a.subjectId,after:r.headers['last-event-id']??0}); reply.header('content-type','text/event-stream; charset=utf-8').header('cache-control','no-cache'); return items.map((e)=>`id: ${e.sequence}\nevent: extension.run\ndata: ${JSON.stringify(e)}\n\n`).join(''); });
  app.delete('/api/v1/extensions/runs/:runId', async (r,reply) => { body(r,['requestId']); const a = await auth(r, 'extension.run.cancel', true); return reply.code(202).send(await service.cancel({runId:r.params.runId,subjectId:a.subjectId,requestId:requestId(r)})); });
  if(management) {
    app.post('/api/v1/skills/custom',async(r,reply)=>{const input=body(r,['requestId','skillId','content','confirmed']);const a=await auth(r,'skill.install',true);return reply.code(201).send(await management.createCustom({...input,subjectId:a.subjectId,requestId:requestId(r)}));});
    app.get('/api/v1/skills/:skillId/definition',async(r,reply)=>{const a=await auth(r,'skill.read');reply.header('cache-control','no-store');return management.definition({subjectId:a.subjectId,skillId:r.params.skillId,requestId:r.requestId});});
    app.patch('/api/v1/skills/:skillId/definition',async(r)=>{const input=body(r,['requestId','baseVersion','patch','confirmed']);const a=await auth(r,'skill.manage',true);return management.updateDefinition({...input,skillId:r.params.skillId,subjectId:a.subjectId,requestId:requestId(r)});});
    app.post('/api/v1/skills/:skillId/translations',async(r,reply)=>{const input=body(r,['requestId','baseVersion','targetLocale','fields','options','confirmed']);const a=await auth(r,'skill.manage',true);await requireScope(r,'ai_task.submit');return reply.code(202).send(await management.translate({...input,skillId:r.params.skillId,subjectId:a.subjectId,requestId:requestId(r)}));});
    app.post('/api/v1/skills/:skillId/translations/apply',async(r)=>{const input=body(r,['requestId','baseVersion','taskId','artifactId','confirmed']);const a=await auth(r,'skill.manage',true);await requireScope(r,'ai_task.read');await requireScope(r,'artifact.read');return management.applyTranslation({...input,skillId:r.params.skillId,subjectId:a.subjectId,requestId:requestId(r)});});
    app.get('/api/v1/mcp/templates',async(r)=>{const a=await auth(r,'mcp.read');return management.listTemplates({subjectId:a.subjectId,requestId:r.requestId});});
    app.put('/api/v1/mcp/:mcpId/config',async(r)=>{const input=body(r,['requestId','baseVersion','config','credentials','confirmed']);const a=await auth(r,'mcp.manage',true);const secureTransport=Boolean(await trustedTransport?.(r))||allowInsecureFixture===true&&process.env.NODE_ENV!=='production';return management.updateMcpConfig({...input,id:r.params.mcpId,subjectId:a.subjectId,requestId:requestId(r),secureTransport});});
  }
  service.management=management;
  return service;
}
