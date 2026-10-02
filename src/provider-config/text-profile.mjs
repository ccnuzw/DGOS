const failure = (key) => { throw Object.assign(new Error(key), { errorKey: key, statusCode: 422 }); };
const OPERATIONS = new Set(['chat.completions', 'responses']);

const keys = (value, allowed) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every((key) => allowed.includes(key));
const optionKeys = ['temperature', 'maxOutputTokens'];
function options(value) { if (value === undefined) return; if (!keys(value, optionKeys) || value.temperature !== undefined && (typeof value.temperature !== 'number' || !Number.isFinite(value.temperature) || value.temperature < 0 || value.temperature > 2) || value.maxOutputTokens !== undefined && (!Number.isSafeInteger(value.maxOutputTokens) || value.maxOutputTokens < 1)) failure('protocol_mismatch'); }
function limits(value) { if (value === undefined) return; if (!keys(value, ['maxInputCharacters', 'maxOutputTokens']) || Object.values(value).some((item) => !Number.isSafeInteger(item) || item < 1)) failure('protocol_mismatch'); }
function ui(value) { if (value === undefined) return; if (!keys(value, ['parameters']) || value.parameters !== undefined && (!Array.isArray(value.parameters) || value.parameters.some((item) => !optionKeys.includes(item)) || new Set(value.parameters).size !== value.parameters.length)) failure('protocol_mismatch'); }

export function validateTextProfile(profile) {
  if (!keys(profile, ['schemaVersion','kind','id','version','label','summary','executor','capabilities','operations','workflows','modelProfiles','defaults','limits','uiSchemas','assets']) || profile.schemaVersion !== 'dgos-capability/v1' || profile.kind !== 'model' || !/^[a-z0-9][a-z0-9._-]*$/.test(profile.id ?? '') || !/^\d+\.\d+\.\d+$/.test(profile.version ?? '')) failure('protocol_mismatch');
  if (!keys(profile.executor, ['type','engine']) || profile.executor.type !== 'declarative' || profile.executor.engine !== 'dgos-text-v1') failure('protocol_mismatch');
  if (!Array.isArray(profile.capabilities) || profile.capabilities.length !== 1 || profile.capabilities[0] !== 'text.chat') failure('capability_mismatch');
  if (!keys(profile.operations, Object.keys(profile.operations ?? {})) || !Object.keys(profile.operations).length) failure('protocol_mismatch');
  for (const [id, operation] of Object.entries(profile.operations)) {
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(id) || !keys(operation, ['profile','method','path']) || operation.method !== 'POST' || !OPERATIONS.has(operation.profile) || operation.profile === 'chat.completions' && operation.path !== '/chat/completions' || operation.profile === 'responses' && operation.path !== '/responses') failure('protocol_mismatch');
  }
  if (!keys(profile.workflows, ['text.chat']) || !keys(profile.workflows['text.chat'], ['submit']) || !profile.operations[profile.workflows['text.chat'].submit]) failure('protocol_mismatch');
  if (!keys(profile.modelProfiles, Object.keys(profile.modelProfiles ?? {})) || !Object.keys(profile.modelProfiles).length) failure('model_profile_missing');
  for (const [id, entry] of Object.entries(profile.modelProfiles)) {
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(id) || !keys(entry, ['modelNames','workflow','defaults','limits','uiSchemas']) || !Array.isArray(entry.modelNames) || !entry.modelNames.length || new Set(entry.modelNames).size !== entry.modelNames.length || entry.modelNames.some((name) => typeof name !== 'string' || !name) || entry.workflow !== 'text.chat') failure('model_profile_missing');
    options(entry.defaults); limits(entry.limits); ui(entry.uiSchemas);
  }
  options(profile.defaults); limits(profile.limits); ui(profile.uiSchemas);
  for (const entry of Object.values(profile.modelProfiles)) {
    const cap = Math.min(profile.limits?.maxOutputTokens ?? Infinity, entry.limits?.maxOutputTokens ?? Infinity);
    const resolved = { ...profile.defaults, ...entry.defaults };
    if (resolved.maxOutputTokens !== undefined && resolved.maxOutputTokens > cap) failure('capability_mismatch');
  }
  if (profile.assets !== undefined && !keys(profile.assets, [])) failure('capability_mismatch');
  return structuredClone(profile);
}

export function resolveTextProfile(profile, modelId) {
  const { registryVersion, digest, status, sourceRef, ...declaration } = profile;
  const validated = validateTextProfile(declaration);
  const matches = Object.entries(validated.modelProfiles).filter(([, item]) => item.modelNames.includes(modelId));
  if (!matches.length) failure('model_profile_missing');
  if (matches.length !== 1) failure('capability_mismatch');
  const [profileId, entry] = matches[0];
  const operation = validated.operations[validated.workflows['text.chat'].submit];
  const limits = {};
  for (const key of ['maxInputCharacters', 'maxOutputTokens']) {
    const values = [validated.limits?.[key], entry.limits?.[key]].filter((value) => value !== undefined);
    if (values.length) limits[key] = Math.min(...values);
  }
  const defaults = { ...validated.defaults, ...entry.defaults };
  if (defaults.maxOutputTokens !== undefined && limits.maxOutputTokens !== undefined && defaults.maxOutputTokens > limits.maxOutputTokens) failure('capability_mismatch');
  return { profileId, modelId, capabilities: ['text'], workflow: 'text.chat', operationProfile: operation.profile, defaults, limits, uiSchemas: entry.uiSchemas ?? validated.uiSchemas ?? {}, assets: {} };
}
