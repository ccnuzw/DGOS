import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';

const invalid = () => Object.assign(new Error('invalid_request'), { statusCode: 422 });
const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
const allowed = (value, names) => isObject(value) && Object.keys(value).every((key) => names.includes(key));
const pick = (value, names) => Object.fromEntries(Object.entries(isObject(value) ? value : {}).filter(([key]) => names.includes(key)));
const effectiveLocale = (uiLocale) => ['en-US', 'zh-CN'].includes(uiLocale) ? uiLocale : 'en-US';
const defaults = () => ({
  appearance: { appearanceMode: 'system', windowMaterial: 'solid', interfaceMode: 'standard', displayScale: 1, wallpaperFollowsAppearance: true },
  locale: { uiLocale: 'en-US', effectiveLocale: 'en-US', regionFormat: 'en-US', assistantLanguage: 'en-US', projectContentLanguage: 'en-US', fallbackState: 'none' },
  network: { proxyMode: 'system', effectiveRoute: 'unavailable', affectedServices: [], restartRequired: true },
  grid: { enabled: true, style: 'dot', spacing: 24, majorLineEvery: 5, showAxes: false, snapEnabled: true, snapTolerance: 8, colorToken: 'grid.default', opacity: 0.35 },
  privacy: { telemetry: false }, appPermissions: [],
});
export const normalizeSystemSettings = (source = {}) => {
  if (!isObject(source)) source = {};
  const base = defaults();
  const appearance = isObject(source.appearance) ? source.appearance : {};
  base.appearance = { ...base.appearance, ...pick(appearance, ['appearanceMode','windowMaterial','interfaceMode','displayScale','lightWallpaperRef','darkWallpaperRef','wallpaperFollowsAppearance']), appearanceMode: appearance.appearanceMode ?? appearance.mode ?? base.appearance.appearanceMode };
  const locale = isObject(source.locale) ? source.locale : {};
  base.locale = { ...base.locale, ...pick(locale, ['uiLocale','regionFormat','assistantLanguage','projectContentLanguage']), uiLocale: locale.uiLocale ?? locale.language ?? base.locale.uiLocale };
  base.locale.effectiveLocale = effectiveLocale(base.locale.uiLocale); base.locale.fallbackState = base.locale.effectiveLocale === base.locale.uiLocale ? 'none' : 'full';
  const network = isObject(source.network) ? source.network : {};
  const proxyMode = network.proxyMode ?? 'system';
  base.network = { ...base.network, proxyMode, effectiveRoute: network.restartRequired ? 'unavailable' : network.effectiveRoute ?? 'unavailable', affectedServices: Array.isArray(network.affectedServices) ? network.affectedServices : [], restartRequired: Boolean(network.restartRequired ?? true) };
  if (typeof network.manualProxyRef === 'string' && /^[a-zA-Z0-9._-]{1,256}$/.test(network.manualProxyRef)) base.network.manualProxyRef = network.manualProxyRef;
  base.grid = { ...base.grid, ...pick(source.grid, ['enabled','style','spacing','majorLineEvery','showAxes','snapEnabled','snapTolerance','colorToken','opacity']) };
  base.privacy = { ...base.privacy, ...pick(source.privacy, ['telemetry']) };
  base.appPermissions = Array.isArray(source.appPermissions) ? source.appPermissions.map((rule) => pick(rule, ['appId','subjectType','subjectId','capability','scope','decision','source'])) : [];
  if (isObject(source._requestReceipts)) base._requestReceipts = source._requestReceipts;
  return base;
};
export const validateSystemDomain = (domain, value) => {
  if (!domains.includes(domain)) throw invalid();
  if (domain === 'appearance' && (!allowed(value, ['appearanceMode','windowMaterial','interfaceMode','displayScale','lightWallpaperRef','darkWallpaperRef','wallpaperFollowsAppearance']) || !['system','light','dark'].includes(value.appearanceMode) || !['solid','translucent'].includes(value.windowMaterial) || !['standard','compact'].includes(value.interfaceMode) || ![0.75,1,1.25,1.5,1.75].includes(value.displayScale) || typeof value.wallpaperFollowsAppearance !== 'boolean' || ['lightWallpaperRef','darkWallpaperRef'].some((key) => value[key] !== undefined && (typeof value[key] !== 'string' || !/^[a-zA-Z0-9._:-]{1,256}$/.test(value[key]))))) throw invalid();
  if (domain === 'locale' && (!allowed(value, ['uiLocale','effectiveLocale','regionFormat','assistantLanguage','projectContentLanguage','fallbackState']) || !/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(value.uiLocale) || ![value.regionFormat,value.assistantLanguage,value.projectContentLanguage].every((item) => typeof item === 'string' && item.length > 0) || value.effectiveLocale !== effectiveLocale(value.uiLocale))) throw invalid();
  if (domain === 'network' && (!allowed(value, ['proxyMode','manualProxyRef','effectiveRoute','affectedServices','restartRequired']) || !['system','manual','off'].includes(value.proxyMode) || value.proxyMode === 'manual' && !value.manualProxyRef || value.manualProxyRef !== undefined && !/^[a-zA-Z0-9._-]{1,256}$/.test(value.manualProxyRef) || typeof value.effectiveRoute !== 'string' || !/^[a-zA-Z0-9._-]{1,64}$/.test(value.effectiveRoute) || !Array.isArray(value.affectedServices) || typeof value.restartRequired !== 'boolean')) throw invalid();
  if (domain === 'grid' && (!allowed(value, ['enabled','style','spacing','majorLineEvery','showAxes','snapEnabled','snapTolerance','colorToken','opacity']) || typeof value.enabled !== 'boolean' || !['dot','line'].includes(value.style) || !Number.isFinite(value.spacing) || value.spacing < 1 || value.spacing > 256 || !Number.isInteger(value.majorLineEvery) || value.majorLineEvery < 1 || value.majorLineEvery > 64 || typeof value.showAxes !== 'boolean' || typeof value.snapEnabled !== 'boolean' || !Number.isFinite(value.snapTolerance) || value.snapTolerance < 0 || value.snapTolerance > 64 || typeof value.colorToken !== 'string' || !/^[-.a-zA-Z0-9]{1,64}$/.test(value.colorToken) || !Number.isFinite(value.opacity) || value.opacity < 0 || value.opacity > 1)) throw invalid();
  if (domain === 'privacy' && (!allowed(value, ['telemetry']) || typeof value.telemetry !== 'boolean')) throw invalid();
  if (domain === 'appPermissions' && (!Array.isArray(value) || value.some((rule) => !allowed(rule, ['appId','subjectType','subjectId','capability','scope','decision','source']) || !['user','organization','team','system'].includes(rule.subjectType) || !['allow','ask','deny'].includes(rule.decision) || !isObject(rule.scope) || !['appId','subjectId','capability'].every((key) => typeof rule[key] === 'string' && rule[key].length > 0)))) throw invalid();
};

const domains = ['appearance', 'locale', 'network', 'grid', 'privacy', 'appPermissions'];
const validators = {
  appearance: (value) => { try { validateSystemDomain('appearance', value); return true; } catch { return false; } },
  locale: (value) => { try { validateSystemDomain('locale', value); return true; } catch { return false; } },
  network: (value) => { try { validateSystemDomain('network', value); return true; } catch { return false; } },
  grid: (value) => { try { validateSystemDomain('grid', value); return true; } catch { return false; } },
  privacy: (value) => { try { validateSystemDomain('privacy', value); return true; } catch { return false; } },
  appPermissions: (value) => { try { validateSystemDomain('appPermissions', value); return true; } catch { return false; } },
};
const redact = (settings) => {
  const value = structuredClone(settings);
  delete value._requestReceipts;
  if (value.network) { delete value.network.proxySecret; delete value.network.token; value.network.proxySecretRef ??= null; }
  if (value.network) { delete value.network.proxySecretRef; delete value.network.proxyUrl; if (!/^[a-zA-Z0-9._-]{1,64}$/.test(value.network.effectiveRoute)) value.network.effectiveRoute = 'unavailable'; }
  return value;
};
const conflict = (current) => Object.assign(new Error('version_conflict'), { statusCode: 409, current });

export class SystemService {
  constructor({ audit, repository, scopeId = '00000000-0000-0000-0000-000000000001' } = {}) {
    this.audit = audit; this.repository = repository; this.scopeId = scopeId;
    this.version = 1; this.contextVersion = 1;
    this.settings = defaults();
    this.events = [];
    this.ready = this.#initialize();
  }
  async #initialize() { await this.repository?.ensure?.(this.scopeId, this.settings); await this.#refresh(); }
  async #refresh() {
    const loaded = await this.repository?.load?.(this.scopeId);
    if (loaded) { this.version = Number(loaded.settingsVersion); this.contextVersion = Number(loaded.contextVersion); this.networkVersion = String(loaded.networkVersion ?? loaded.settingsVersion); this.settings = normalizeSystemSettings(loaded.settings); }
    return { settingsVersion: String(this.version), networkVersion: this.networkVersion ?? String(this.version), contextVersion: String(this.contextVersion), settings: this.settings };
  }
  async snapshot() { await this.ready; const current = await this.#refresh(); return { settingsVersion: current.settingsVersion, settings: redact(current.settings) }; }
  async runtimeSnapshot() { await this.ready; const current = await this.#refresh(); return { settingsVersion: current.networkVersion, settings: { network: { proxyMode: current.settings.network.proxyMode, manualProxyRef: current.settings.network.manualProxyRef } } }; }
  async activateNetworkRoute(route, { role, instanceId, leaseMs = 15_000 } = {}) {
    if (!['api','worker'].includes(role) || !/^[0-9a-f-]{36}$/i.test(instanceId ?? '')) throw new Error('network_activation_invalid');
    const snapshot = await this.runtimeSnapshot();
    return route.activateFromSnapshot(snapshot, { onActivated: async (state) => {
      await this.repository?.recordNetworkActivation?.(this.scopeId, { ...state, role, instanceId, leaseMs });
    } }).then((state) => { route.confirmLease?.(leaseMs); return state; });
  }
  async renewNetworkRoute(route, { role, instanceId, leaseMs = 15_000 } = {}) {
    const state = route.active();
    if (!state) throw new Error('route_unavailable');
    try { await this.repository?.recordNetworkActivation?.(this.scopeId, { ...state, role, instanceId, leaseMs }); route.confirmLease?.(leaseMs); }
    catch (error) { route.suspendLease?.(); throw error; }
  }
  async releaseNetworkRoute(instanceId) { await this.repository?.releaseNetworkActivation?.(this.scopeId, instanceId); }
  async context() { await this.ready; const current = await this.#refresh(); return { contextVersion: current.contextVersion, settings: redact(current.settings), runtimeVersion: 'v1' }; }
  async replayRequest({ actorId, requestId, fingerprint }) {
    await this.ready;
    const current = await this.#refresh();
    const receipt = current.settings._requestReceipts?.[`${actorId ?? 'system'}:${requestId}`];
    if (!receipt) return undefined;
    if (receipt.digest !== fingerprint) throw conflict(await this.snapshot());
    return receipt.result;
  }
  async patch({ patch, baseVersion, actorId, requestId, idempotencyFingerprint }) {
    await this.ready;
    const domain = patch?.domain;
    if (!domains.includes(domain)) throw invalid();
    const digest = idempotencyFingerprint ?? createHash('sha256').update(JSON.stringify({ domain, value: patch.value, baseVersion })).digest('hex');
    const current = await this.#refresh();
    const receiptKey = `${actorId ?? 'system'}:${requestId}`;
    const replay = requestId && current.settings._requestReceipts?.[receiptKey];
    if (replay) { if (replay.digest !== digest) throw conflict(await this.snapshot()); return replay.result; }
    let value = patch.value === undefined ? undefined : structuredClone(patch.value);
    if (domain !== 'appPermissions' && isObject(value)) value = { ...current.settings[domain], ...value };
    if (domain === 'appearance' && isObject(value) && 'mode' in value) { value.appearanceMode = value.mode; delete value.mode; }
    if (domain === 'locale' && isObject(value) && 'language' in value) { value.uiLocale = value.language; delete value.language; }
    if (domain === 'locale' && isObject(value)) { value.effectiveLocale = effectiveLocale(value.uiLocale); value.fallbackState = effectiveLocale(value.uiLocale) === value.uiLocale ? 'none' : 'full'; }
    if (domain === 'network' && isObject(value)) value = { ...current.settings.network, ...value, effectiveRoute: 'unavailable', affectedServices: current.settings.network.affectedServices, restartRequired: true };
    if (!validators[domain]?.(value)) throw invalid();
    if (String(baseVersion) !== current.settingsVersion) throw conflict({ settingsVersion: current.settingsVersion, settings: redact(current.settings) });
    if (domain === 'network' && value.proxyMode === 'manual') await this.networkProxyValidator?.(value.manualProxyRef);
    const next = structuredClone(current.settings); next[domain] = value;
    const restartRequired = domain === 'network';
    const event = { eventId: randomUUID(), contextVersion: String(Number(current.contextVersion) + 1), domain, restartRequired };
    const auditEvent = { requestId: requestId ?? randomUUID(), actorId, action: 'system.settings.patch', targetType: 'system_settings', targetId: null, summary: { domain, settingsVersion: String(Number(current.settingsVersion) + 1), restartRequired } };
    const result = { settingsVersion: String(Number(current.settingsVersion) + 1), settings: redact(next), restartRequired: Boolean(next.network.restartRequired), contextVersion: event.contextVersion };
    if (requestId) { next._requestReceipts ??= {}; next._requestReceipts[receiptKey] = { digest, result }; }
    if (this.repository?.save) {
      let saved;
      try { saved = await this.repository.save(this.scopeId, { settingsVersion: current.settingsVersion, settings: next }, event, auditEvent, this.audit); }
      catch (cause) {
        if (cause.statusCode !== 409) throw cause;
        const refreshed = await this.#refresh();
        const retried = requestId && refreshed.settings._requestReceipts?.[receiptKey];
        if (retried?.digest === digest) return retried.result;
        throw conflict(await this.snapshot());
      }
      this.version = Number(saved.settingsVersion); this.contextVersion = Number(saved.contextVersion); this.settings = next;
      return result;
    } else {
      if (!this.audit?.record) throw Object.assign(new Error('audit_unavailable'), { statusCode: 503 });
      await this.audit.record(auditEvent);
      this.settings = next; this.version = Number(current.settingsVersion) + 1; this.contextVersion = Number(current.contextVersion) + 1; this.events.push(event);
    }
    return result;
  }
  getEvents(after = 0) { return this.events.filter((event) => Number(event.contextVersion) > Number(after)); }
}
