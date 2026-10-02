import dns from 'node:dns/promises';
import https from 'node:https';
import tls from 'node:tls';
import net from 'node:net';

const BLOCKED_HOSTS = new Set(['localhost', 'metadata.google.internal']);
const BLOCKED_IPV4 = [/^127\./, /^10\./, /^192\.168\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^0\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, /^19[89]\./, /^2(2[4-9]|[3-5]\d)\./];
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RESPONSE_BYTES = 1_048_576;

function isBlockedAddress(address) {
  if (net.isIPv4(address)) return BLOCKED_IPV4.some((pattern) => pattern.test(address));
  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    return normalized === '::' || normalized === '::1' || /^fe[89ab]/.test(normalized) || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('::ffff:');
  }
  return true;
}

const error = (message, errorKey) => Object.assign(new Error(message), { errorKey });
const policyError = () => error('policy_blocked', 'policy_blocked');

function responseFromBuffer({ statusCode, headers, body }) {
  return { status: statusCode, ok: statusCode >= 200 && statusCode < 300, headers, body: [body], async arrayBuffer() { return body; }, async text() { return body.toString('utf8'); }, async json() { return JSON.parse(body.toString('utf8')); } };
}

function pinnedHttpsRequest({ target, address, method, headers, body, signal, timeoutMs, maxResponseBytes, ca, streamResponse }) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => { if (settled) return; settled = true; fn(value); };
    let streamFailure;
    const abort = () => request.destroy(error('cancelled', 'cancelled'));
    const deadline = setTimeout(() => request.destroy(error('timed_out', 'timed_out')), timeoutMs);
    const cleanup = () => { clearTimeout(deadline); signal?.removeEventListener('abort', abort); };
    const request = https.request({ hostname: address, port: Number(target.port || 443), path: `${target.pathname}${target.search}`, method, headers: { ...headers, host: target.host }, servername: target.hostname, rejectUnauthorized: true, ca, checkServerIdentity: (_host, certificate) => tls.checkServerIdentity(target.hostname, certificate), timeout: timeoutMs }, (response) => {
      const statusCode = response.statusCode ?? 0;
      if (statusCode >= 300 && statusCode < 400) { finish(reject, policyError()); response.destroy(); return; }
      if (streamResponse) {
        response.on('error', (cause) => { streamFailure ??= cause.errorKey ? cause : error('network_unreachable', 'network_unreachable'); });
        const chunks = (async function* () {
          let size = 0;
          try {
            for await (const chunk of response) {
              size += chunk.byteLength;
              if (size > maxResponseBytes) throw error('response_too_large', 'response_too_large');
              yield chunk;
            }
            if (streamFailure) throw streamFailure;
            if (!response.complete) throw error('network_unreachable', 'network_unreachable');
          } catch (cause) { throw streamFailure ?? (cause.errorKey ? cause : error('network_unreachable', 'network_unreachable')); }
          finally { cleanup(); response.destroy(); request.destroy(); }
        })();
        const arrayBuffer = async () => { const all = []; for await (const chunk of chunks) all.push(chunk); return Buffer.concat(all); };
        finish(resolve, { status: statusCode, ok: statusCode >= 200 && statusCode < 300, headers: response.headers, body: chunks, arrayBuffer, async text() { return (await arrayBuffer()).toString('utf8'); }, async json() { return JSON.parse(await this.text()); } });
        return;
      }
      const chunks = []; let size = 0;
      response.on('data', (chunk) => { size += chunk.length; if (size > maxResponseBytes) { finish(reject, error('response_too_large', 'response_too_large')); response.destroy(); return; } chunks.push(chunk); });
      response.on('end', () => { const statusCode = response.statusCode ?? 0; if (statusCode >= 300 && statusCode < 400) finish(reject, policyError()); else finish(resolve, responseFromBuffer({ statusCode, headers: response.headers, body: Buffer.concat(chunks) })); });
      response.on('error', (cause) => finish(reject, error(cause.message, 'upstream_unavailable')));
      response.on('close', () => { if (!response.complete) finish(reject, error('network_unreachable', 'network_unreachable')); });
    });
    request.on('timeout', () => request.destroy(error('timed_out', 'timed_out')));
    request.on('error', (cause) => { streamFailure = cause.errorKey ? cause : error('network_unreachable', /CERT|TLS|ALTNAME|SELF_SIGNED/.test(cause.code ?? '') ? 'tls_invalid' : 'network_unreachable'); finish(reject, streamFailure); });
    request.once('close', cleanup);
    if (signal) { if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true }); }
    if (body) request.write(body);
    request.end();
  });
}

export class ProviderEgress {
  #lookup; #fetch; #allowHosts; #internalHosts; #ca; #timeoutMs; #maxResponseBytes;
  constructor({ lookup = (host) => dns.lookup(host, { all: true }), fetchImpl, allowHosts = [], internalHosts = [], ca, timeoutMs = DEFAULT_TIMEOUT_MS, maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES } = {}) {
    if (fetchImpl !== undefined && typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
    this.#lookup = lookup; this.#fetch = fetchImpl; this.#allowHosts = new Set(allowHosts); this.#internalHosts = new Set(internalHosts); this.#ca = ca; this.#timeoutMs = timeoutMs; this.#maxResponseBytes = maxResponseBytes;
  }
  async resolveTarget(rawUrl, { signal, timeoutMs = this.#timeoutMs } = {}) {
    let url; try { url = new URL(rawUrl); } catch { throw error('endpoint_invalid', 'endpoint_invalid'); }
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443' && !this.#internalHosts.has(url.hostname.toLowerCase()))) throw error('endpoint_invalid', 'endpoint_invalid');
    const host = url.hostname.toLowerCase();
    if (BLOCKED_HOSTS.has(host) || (this.#allowHosts.size > 0 && !this.#allowHosts.has(host) && !this.#internalHosts.has(host))) throw policyError();
    let addresses;
    if (signal?.aborted) throw error('cancelled', 'cancelled');
    try {
      addresses = net.isIP(host) ? [{ address: host }] : await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { cleanup(); reject(error('timed_out', 'timed_out')); }, timeoutMs);
        const abort = () => { cleanup(); reject(error('cancelled', 'cancelled')); };
        const cleanup = () => { clearTimeout(timeout); signal?.removeEventListener('abort', abort); };
        signal?.addEventListener('abort', abort, { once: true });
        Promise.resolve().then(() => this.#lookup(host)).then((value) => { cleanup(); resolve(value); }, () => { cleanup(); reject(error('network_unreachable', 'network_unreachable')); });
      });
    } catch (cause) { throw cause.errorKey ? cause : error('network_unreachable', 'network_unreachable'); }
    if (!Array.isArray(addresses) || !addresses.length || addresses.some((item) => !item || !net.isIP(item.address))) throw policyError();
    const valid = addresses.map(({ address }) => address).filter((address) => this.#internalHosts.has(host) || !isBlockedAddress(address));
    if (valid.length === 0 || valid.length !== addresses.length) throw policyError();
    return { url, addresses: valid };
  }
  async validateTarget(rawUrl) { return (await this.resolveTarget(rawUrl)).url; }
  async request({ url, method = 'GET', headers = {}, body, signal, timeoutMs = this.#timeoutMs, maxResponseBytes = this.#maxResponseBytes, streamResponse = false }) {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || !Number.isSafeInteger(maxResponseBytes) || maxResponseBytes <= 0 || typeof streamResponse !== 'boolean') throw error('endpoint_invalid', 'endpoint_invalid');
    const deadline = Date.now() + timeoutMs;
    const { url: target, addresses } = await this.resolveTarget(url, { signal, timeoutMs });
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw error('timed_out', 'timed_out');
    if (this.#fetch) { const response = await this.#fetch(target, { method, headers, body, redirect: 'manual', signal }); if (response.status >= 300 && response.status < 400) throw policyError(); return response; }
    return pinnedHttpsRequest({ target, address: addresses[0], method, headers, body, signal, timeoutMs: remaining, maxResponseBytes, ca: this.#ca, streamResponse });
  }
}
