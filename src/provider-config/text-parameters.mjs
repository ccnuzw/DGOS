import { createHash } from 'node:crypto';

const fail = (key) => { throw Object.assign(new Error(key), { errorKey: key, statusCode: 422 }); };
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => [key, canonical(value[key])])) : value;
export const executionDigest = (value) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
export const normalizeRequestParameters = (value) => {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('invalid_request');
  for (const key of Object.keys(value)) if (!['temperature', 'maxOutputTokens'].includes(key)) fail('invalid_request');
  if (value.temperature !== undefined && (typeof value.temperature !== 'number' || !Number.isFinite(value.temperature) || value.temperature < 0 || value.temperature > 2)) fail('invalid_request');
  if (value.maxOutputTokens !== undefined && (!Number.isSafeInteger(value.maxOutputTokens) || value.maxOutputTokens < 1)) fail('invalid_request');
  return Object.fromEntries(['temperature', 'maxOutputTokens'].filter((key) => Object.hasOwn(value, key)).map((key) => [key, value[key]]));
};
export function normalizeTextExecution({ adapter, textProfile, parameters, input }) {
  const explicit = normalizeRequestParameters(parameters);
  const descriptor = adapter.descriptor?.() ?? { parameters: ['temperature', 'maxOutputTokens'], limits: {} };
  const supported = descriptor.parameters ?? [];
  if (!Array.isArray(supported) || supported.some((key) => !['temperature', 'maxOutputTokens'].includes(key))) fail('capability_mismatch');
  const defaults = { ...(descriptor.defaults ?? {}), ...(textProfile?.defaults ?? {}) };
  const limits = {};
  for (const key of ['maxInputCharacters', 'maxOutputTokens']) {
    const values = [descriptor.limits?.[key], textProfile?.limits?.[key]].filter((value) => value !== undefined);
    if (values.length) limits[key] = Math.min(...values);
  }
  for (const key of Object.keys(defaults)) if (!supported.includes(key)) fail('capability_mismatch');
  for (const key of Object.keys(explicit)) if (!supported.includes(key)) fail('capability_mismatch');
  normalizeRequestParameters(defaults);
  const normalizedParameters = normalizeRequestParameters({ ...defaults, ...explicit });
  if (normalizedParameters.maxOutputTokens !== undefined && limits.maxOutputTokens !== undefined && normalizedParameters.maxOutputTokens > limits.maxOutputTokens) fail('invalid_request');
  if (typeof input !== 'string' || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(input)) fail('invalid_request');
  if (limits.maxInputCharacters !== undefined && [...input].length > limits.maxInputCharacters) fail('invalid_request');
  const uiSchemas = textProfile?.uiSchemas?.parameters ? { parameters: textProfile.uiSchemas.parameters.filter((key) => supported.includes(key)) } : {};
  return { normalizedParameters, effectiveDefaults: defaults, effectiveLimits: limits, uiSchemas };
}
