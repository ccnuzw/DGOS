import { PermissionBroker } from '../../../src/permissions/broker.mjs';

const invalid = () => Object.assign(new Error('invalid_request'), { statusCode: 422 });
function inputFields(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some((key) => !fields.includes(key))) throw invalid();
  return value;
}

// The signed manifest selects capabilities, never HTTP URLs, credentials or actors.
export function createAppCapabilities({ permissionRepository, audit, aiTasks, providerConfigs, resolveModel, system }) {
  const permissions = new PermissionBroker({ repository: permissionRepository, audit });
  const bridgeAuthorize = async ({ subjectId, appId, capability, requestId }) => {
    const result = await permissions.check({ subjectId, appId, capability, requestId });
    if (result.decision !== 'allow') return false;
    if (capability === 'dgos.system.context.events') {
      const read = await permissions.check({ subjectId, appId, capability: 'dgos.system.context.read', requestId });
      return read.decision === 'allow';
    }
    return true;
  };
  const appContext = async ({ appId, instanceId }) => {
    if (!appId || !instanceId || !system?.context) throw Object.assign(new Error('service_unavailable'), { statusCode: 503 });
    const { contextVersion, settings } = await system.context();
    const { proxyMode, effectiveRoute, affectedServices, restartRequired } = settings.network;
    return { contextVersion, appId, instanceId, appearance: settings.appearance, locale: settings.locale, grid: settings.grid, networkSummary: { proxyMode, effectiveRoute, affectedServices, restartRequired }, issuedAt: new Date().toISOString() };
  };
  const bridgeHandlers = {
    'dgos.system.context.read': async (context) => {
      inputFields(context.input, []);
      return appContext(context);
    },
    'dgos.system.context.events': async (context) => {
      inputFields(context.input, ['cursor']);
      const { cursor } = context.input;
      if (typeof cursor !== 'string' || !/^(0|[1-9][0-9]*)$/.test(cursor) || cursor.length > 32) throw invalid();
      const latest = await appContext(context);
      const version = BigInt(latest.contextVersion);
      const previous = BigInt(cursor);
      return { items: version === previous ? [] : [latest], cursor: latest.contextVersion, reset: previous > version || previous === 0n };
    },
    'dgos.aiTask.submit': async ({ subjectId, requestId, input }) => {
      inputFields(input, ['target', 'intent', 'input', 'options']);
      inputFields(input.input, ['text']);
      inputFields(input.options, ['providerConfigId', 'modelId', 'parameters']);
      if (input.options.parameters !== undefined) {
        const parameters = inputFields(input.options.parameters, ['temperature', 'maxOutputTokens']);
        if (parameters.temperature !== undefined && (!Number.isFinite(parameters.temperature) || parameters.temperature < 0 || parameters.temperature > 2)) throw invalid();
        if (parameters.maxOutputTokens !== undefined && (!Number.isSafeInteger(parameters.maxOutputTokens) || parameters.maxOutputTokens < 1)) throw invalid();
      }
      return aiTasks.submit({ ...input, ownerId: subjectId, requestId });
    },
    'dgos.aiTask.get': async ({ subjectId, input }) => {
      inputFields(input, ['taskId']);
      return aiTasks.get(input.taskId, subjectId);
    },
    'dgos.aiTask.events': async ({ subjectId, input }) => {
      inputFields(input, ['taskId', 'cursor']);
      const cursor = input.cursor ?? 0;
      if (!Number.isSafeInteger(cursor) || cursor < 0) throw invalid();
      return { items: await aiTasks.events(input.taskId, subjectId, cursor) };
    },
    'dgos.aiTask.cancel': async ({ subjectId, requestId, input }) => {
      inputFields(input, ['taskId']);
      return aiTasks.cancel(input.taskId, subjectId, requestId);
    },
    'dgos.artifact.read': async ({ subjectId, requestId, input }) => {
      inputFields(input, ['artifactId']);
      const artifact = await aiTasks.artifact(input.artifactId, subjectId);
      await audit.record({ actorId: subjectId, requestId, action: 'artifact.read', targetType: 'artifact', targetId: input.artifactId, summary: {} });
      return artifact;
    },
    'dgos.model.list': async ({ subjectId, input }) => {
      inputFields(input, ['providerConfigId']);
      if (input.providerConfigId !== undefined && (typeof input.providerConfigId !== 'string' || !input.providerConfigId)) throw invalid();
      const { items: configs } = await providerConfigs.list(subjectId);
      const items = [];
      for (const config of configs) {
        const providerConfigId = config.id;
        if (input.providerConfigId && input.providerConfigId !== providerConfigId) continue;
        if (config.status !== 'ready') continue;
        const catalog = await providerConfigs.models(providerConfigId, subjectId);
        if (catalog.status !== 'fresh') continue;
        for (const model of catalog.items) {
          try {
            await resolveModel({ ownerId: subjectId, providerConfigId, modelId: model.modelId, intent: 'text.chat' });
            items.push({ providerConfigId, modelId: model.modelId, displayName: model.displayName, intent: 'text.chat' });
          } catch (error) {
            if (!['provider_config_disabled', 'provider_account_disabled', 'model_catalog_stale', 'model_not_found', 'model_not_allowed', 'capability_mismatch', 'model_profile_missing', 'protocol_unavailable'].includes(error.message)) throw error;
          }
        }
      }
      return { items };
    },
    'dgos.model.resolve': async ({ subjectId, input }) => {
      inputFields(input, ['providerConfigId', 'modelId', 'intent']);
      if (typeof input.providerConfigId !== 'string' || !input.providerConfigId || typeof input.modelId !== 'string' || !input.modelId || input.intent !== 'text.chat') throw invalid();
      if (!resolveModel) throw Object.assign(new Error('model_profile_unavailable'), { statusCode: 503 });
      return resolveModel({ ownerId: subjectId, ...input });
    },
  };
  return { bridgeHandlers, bridgeAuthorize };
}
