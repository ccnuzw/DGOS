import { createHash } from 'node:crypto';
import { bridgeJson } from '../apps/package-service.mjs';

export const digest = (value) => createHash('sha256').update(bridgeJson(value,{maxBytes:262144,maxDepth:32,maxEntries:10000})).digest('hex');
export function invalid(key = 'invalid_request', statusCode = 422) { return Object.assign(new Error(key), { statusCode }); }
export function requireId(value) { if (typeof value !== 'string' || !/^[a-z0-9_][a-z0-9_.-]{0,127}$/.test(value)) throw invalid(); return value; }
export function requireRequestId(value) { if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/i.test(value)) throw invalid(); return value; }
export function assertPlain(value, { allowCredentialRef = false } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  const text = JSON.stringify(value);
  const checked = allowCredentialRef ? text.replaceAll(/"credentialRef"\s*:\s*"[^"]*"/g, '"credentialRef":"redacted"') : text;
  if (text.length > 65_536 || /(?:authorization|cookie|password|api[_-]?key|token|secret|systemPrompt|cwd|command|env)/i.test(checked)) throw invalid('sensitive_config_rejected');
}
export function validateManifest(manifest, kind) {
  assertPlain(manifest);
  if (manifest.kind !== kind || !requireId(manifest.id) || typeof manifest.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(manifest.version)) throw invalid();
  if (!Array.isArray(manifest.operations) || !manifest.operations.length || manifest.operations.length > 64) throw invalid();
  if (kind === 'skill') {
    if (typeof manifest.packageId !== 'string') throw invalid();
    requireId(manifest.packageId);
    if (manifest.childSkillIds && (!Array.isArray(manifest.childSkillIds) || manifest.childSkillIds.some((id)=>{ try { requireId(id); return false; } catch { return true; } }))) throw invalid();
  }
  for (const op of manifest.operations) {
    if (!op || typeof op !== 'object' || !requireId(op.operationId) || typeof op.permission !== 'string' || !op.permission || !['low','medium','high'].includes(op.risk) || typeof op.sideEffects !== 'boolean' || !op.inputSchema || op.inputSchema.type !== 'object') throw invalid();
    if (op.outputSchema && op.outputSchema.type !== 'object') throw invalid();
  }
  return manifest;
}
export function validateConfig(config = {}, manifest) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw invalid();
  const allowed = new Set(['transport','runnerProfileId','endpointRef','settings']);
  if (Object.keys(config).some((key) => !allowed.has(key))) throw invalid('invalid_request');
  if (config.transport && !['stdio','streamable-http'].includes(config.transport)) throw invalid();
  if (config.runnerProfileId) requireId(config.runnerProfileId);
  if (config.endpointRef) requireId(config.endpointRef);
  if (config.transport === 'stdio' && !config.runnerProfileId) throw invalid();
  if (config.transport === 'streamable-http' && !config.endpointRef) throw invalid();
  if (config.settings) {
    assertPlain(config.settings);
    if (!manifest.configSchema) { if (Object.keys(config.settings).length) throw invalid(); }
    else validateInput(manifest.configSchema, config.settings);
  }
  return config;
}
export function validateInput(schema, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalid();
  if (JSON.stringify(input).length > 65_536) throw invalid();
  for (const name of schema.required ?? []) if (!(name in input)) throw invalid();
  for (const [name, value] of Object.entries(input)) {
    if (!Object.hasOwn(schema.properties ?? {}, name)) throw invalid();
    const expected = schema.properties[name]?.type;
    if (expected && (expected === 'array' ? !Array.isArray(value) : expected === 'object' ? !value || typeof value !== 'object' || Array.isArray(value) : typeof value !== expected)) throw invalid();
  }
  assertPlain(input);
}
