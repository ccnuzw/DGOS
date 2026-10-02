import { resolveTextProfile } from './text-profile.mjs';
import { normalizeTextExecution } from './text-parameters.mjs';

const reject = (key, statusCode = 422) => { throw Object.assign(new Error(key), { errorKey: key, statusCode }); };

// Called only for a new submission. Existing taskId recovery must use its saved attempt.
export function createTaskAdmission({ configRepository, accountRepository, registry, profileDirectory }) {
  return async function admission({ ownerId, providerConfigId, modelId, intent, transactionClient, parameters, input }) {
    const config = await configRepository.get(providerConfigId, transactionClient);
    if (!config || config.ownerId !== ownerId) reject('provider_config_not_found', 404);
    if (config.status !== 'ready') reject('provider_config_disabled');
    const account = await accountRepository.getAccount(config.providerAccountId, transactionClient);
    if (!account || account.ownerId !== ownerId) reject('provider_account_not_found', 404);
    if (account.status !== 'ready') reject('provider_account_disabled');
    if (account.protocolType !== config.protocolType) reject('protocol_mismatch');
    const adapter = registry.get(config.protocolType);
    if (config.protocolVersion && config.protocolVersion !== adapter.protocolVersion) reject('protocol_unavailable');
    const catalog = await configRepository.getCatalog(config.providerConfigId, transactionClient);
    if (catalog?.status !== 'fresh') reject('model_catalog_stale');
    const model = catalog.items.find((item) => item.modelId === modelId);
    if (!model) reject('model_not_found');
    const capability = intent === 'text.chat' ? 'text' : intent;
    if (!model.taskModes.includes(intent)) reject('capability_mismatch');
    const policies = await configRepository.listPolicies(config.providerConfigId, transactionClient);
    const policy = policies.find((item) => item.modelId === modelId);
    if (!policy?.enabled || !policy.assignedCapabilities.includes(capability)) reject('model_not_allowed');
    let textProfile; let declarationDigest;
    if (config.capabilityProtocolId || config.capabilityProtocolVersion) {
      if (!config.capabilityProtocolId || !config.capabilityProtocolVersion || !profileDirectory?.getActive) reject('protocol_unavailable');
      const declaration = await profileDirectory.getActive(ownerId, config.capabilityProtocolId, config.capabilityProtocolVersion, transactionClient);
      if (!declaration) reject('protocol_unavailable');
      textProfile = resolveTextProfile(declaration, modelId);
      declarationDigest = declaration.digest;
      if (!registry.get(config.protocolType).descriptor().operationProfiles.includes(textProfile.operationProfile)) reject('capability_mismatch');
    }
    const execution = input === undefined ? undefined : normalizeTextExecution({ adapter, textProfile, parameters, input });
    return { config, account, model, policy, catalogVersion: catalog.catalogVersion, textProfile, declarationDigest, adapterDescriptor: adapter.descriptor?.() ?? { descriptorVersion: adapter.descriptorVersion, parameters: ['temperature', 'maxOutputTokens'] }, execution };
  };
}

export function createModelResolver(dependencies) {
  const admission = createTaskAdmission(dependencies);
  return async function resolveModel({ ownerId, providerConfigId, modelId, intent }) {
    if (intent !== 'text.chat') reject('capability_mismatch');
    const { config, model, policy, textProfile, catalogVersion } = await admission({ ownerId, providerConfigId, modelId, intent });
    const adapter = dependencies.registry.get(config.protocolType);
    const profile = textProfile?.operationProfile ?? 'chat.completions';
    if (!adapter.descriptor().operationProfiles.includes(profile)) reject('capability_mismatch');
    const projected = normalizeTextExecution({ adapter, textProfile, input: '' });
    return { providerConfigId: config.providerConfigId, modelId: model.modelId, intent, descriptorVersion: config.descriptorVersion ?? adapter.descriptorVersion, profile, workflow: textProfile?.workflow ?? 'text.chat', defaults: projected.effectiveDefaults, limits: projected.effectiveLimits, uiSchemas: projected.uiSchemas, assets: textProfile?.assets ?? {}, ...(textProfile ? { protocolId: config.capabilityProtocolId, protocolVersion: config.capabilityProtocolVersion } : {}) };
  };
}
