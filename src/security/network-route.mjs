import dns from 'node:dns/promises';
import { createHash } from 'node:crypto';
import { proxyHttpsRequest, validateProxyConfig } from './proxy-transport.mjs';

const fail = (key) => Object.assign(new Error(key), { errorKey: key });
const affectedServices = Object.freeze(['provider', 'model-catalog', 'ai-task', 'mcp-http', 'online-import']);

export function createNetworkRouteFactory({ egress, secretService, systemProxyProvider = async () => null, proxyLookup = (host) => dns.lookup(host, { all: true }), ca, proxyCa, allowLocalFixture = false, fixtureLookup, fixtureCa } = {}) {
  if (!egress?.request || !egress?.validateTarget || !secretService?.resolve) throw new TypeError('egress and secretService are required');
  let active;
  let leaseUntil = Infinity;
  let leaseRequired = false;
  let leaseEpoch = 0;
  let leaseController = new AbortController();
  let leaseTimer;
  let activation = Promise.resolve();
  const describe = (route) => ({ effectiveRoute: route.kind, affectedServices: [...affectedServices], settingsVersion: route.settingsVersion, routeFingerprint: route.fingerprint });
  const fingerprint = (proxy) => createHash('sha256').update(proxy ? JSON.stringify({ url: proxy.url.toString(), authorization: proxy.authorization ?? null, version: proxy.version ?? null }) : 'direct').digest('hex');
  const resolveProxy = async (mode, ref) => {
    if (mode === 'off') return null;
    if (mode === 'system') { const provided = await systemProxyProvider(); return provided ? { ...validateProxyConfig(provided, { allowLocalFixture }), version: provided.credentialVersion } : null; }
    if (mode !== 'manual' || typeof ref !== 'string' || !ref) throw fail('proxy_configuration_invalid');
    const handle = await secretService.resolve({ secretRef: ref, purpose: 'network-proxy', subjectId: 'system' });
    let parsed;
    try { parsed = JSON.parse(await handle.read()); } catch { throw fail('credential_unavailable'); }
    return { ...validateProxyConfig(parsed, { allowLocalFixture }), version: handle.version };
  };
  return {
    ...(allowLocalFixture ? { fixtureMode: true, fixtureLookup, fixtureCa } : {}),
    active: () => active && describe(active),
    activateFromSnapshot(snapshot, { onActivated } = {}) {
      const task = activation.then(async () => {
        const network = snapshot?.settings?.network;
        if (!network || !['off', 'system', 'manual'].includes(network.proxyMode)) throw fail('proxy_configuration_invalid');
        const proxy = await resolveProxy(network.proxyMode, network.manualProxyRef);
        if (proxy && !egress.resolveTarget) throw fail('route_unavailable');
        const next = Object.freeze({ kind: proxy ? (network.proxyMode === 'manual' ? 'manual' : 'system') : 'direct', manualProxyRef: network.proxyMode === 'manual' ? network.manualProxyRef : null, fingerprint: fingerprint(proxy), settingsVersion: String(snapshot.settingsVersion) });
        const result = describe(next);
        await onActivated?.(result);
        active = next;
        if (leaseRequired) { clearTimeout(leaseTimer); leaseUntil = 0; leaseEpoch += 1; leaseController.abort(); leaseController = new AbortController(); }
        return result;
      });
      activation = task.catch(() => {});
      return task;
    },
    async request(input) {
      return requestWith(egress, input);
    },
    forEgress(scopedEgress) {
      if (!scopedEgress?.request || !scopedEgress?.resolveTarget || !scopedEgress?.validateTarget) throw new TypeError('scoped egress required');
      return { request: (input) => requestWith(scopedEgress, input), validateTarget: (url) => scopedEgress.validateTarget(url) };
    },
    validateProxyReference: (ref) => resolveProxy('manual', ref).then(() => undefined),
    requireLease() { leaseRequired = true; leaseUntil = 0; leaseEpoch += 1; leaseController.abort(); leaseController = new AbortController(); },
    confirmLease(ms) {
      if (!Number.isSafeInteger(ms) || ms < 1) throw fail('route_unavailable');
      clearTimeout(leaseTimer);
      if (leaseController.signal.aborted) leaseController = new AbortController();
      leaseUntil = Date.now() + ms;
      leaseTimer = setTimeout(() => { leaseUntil = 0; leaseEpoch += 1; leaseController.abort(); }, ms);
      leaseTimer.unref();
    },
    suspendLease() { clearTimeout(leaseTimer); leaseUntil = 0; leaseEpoch += 1; leaseController.abort(); },
    validateTarget: (url) => egress.validateTarget(url),
    resolveTarget: (url) => egress.resolveTarget?.(url) ?? Promise.reject(fail('route_unavailable')),
  };
  async function requestWith(policy, input) {
    if (!active || leaseRequired && leaseUntil <= Date.now()) throw fail('route_unavailable');
    const route = active;
    const requestEpoch = leaseEpoch;
    const routedInput = leaseRequired ? { ...input, signal: input.signal ? AbortSignal.any([input.signal, leaseController.signal]) : leaseController.signal } : input;
    if (route.kind === 'direct') {
      if (route.fingerprint !== fingerprint(null)) throw fail('route_unavailable');
      if (leaseRequired && (leaseUntil <= Date.now() || leaseEpoch !== requestEpoch)) throw fail('route_unavailable');
      return policy.request(routedInput);
    }
    if (!policy.resolveTarget) throw fail('route_unavailable');
    const timeoutMs = input.timeoutMs ?? 15_000;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw fail('endpoint_invalid');
    const deadline = Date.now() + timeoutMs;
    const remaining = () => { const ms = deadline - Date.now(); if (ms <= 0) throw fail('timed_out'); return ms; };
    const { url: target, addresses } = await policy.resolveTarget(input.url, { signal: routedInput.signal, timeoutMs: remaining() });
    const proxy = route.manualProxyRef ? await resolveProxy('manual', route.manualProxyRef) : await resolveProxy('system');
    if (!proxy) throw fail('route_unavailable');
    if (fingerprint(proxy) !== route.fingerprint) throw fail('route_unavailable');
    if (leaseRequired && (leaseUntil <= Date.now() || leaseEpoch !== requestEpoch)) throw fail('route_unavailable');
    return proxyHttpsRequest({ ...routedInput, timeoutMs: remaining(), target, address: addresses[0], proxy, lookup: proxyLookup, ca, proxyCa, allowLocalFixture });
  }
}
