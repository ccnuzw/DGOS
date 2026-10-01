import dns from 'node:dns/promises';
import https from 'node:https';
import net from 'node:net';

const BLOCKED_HOSTS = new Set(['localhost', 'metadata.google.internal']);
const BLOCKED_IPV4 = [/^127\./, /^10\./, /^192\.168\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^0\./];
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RESPONSE_BYTES = 1_048_576;

function isBlockedAddress(address) {
  if (net.isIPv4(address)) return BLOCKED_IPV4.some((pattern) => pattern.test(address));
  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    return normalized === '::1' || normalized.startsWith('fe80:') || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('::ffff:127.');
  }
  return true;
}

const error = (message, errorKey) => Object.assign(new Error(message), { errorKey });
const policyError = () => error('policy_blocked', 'policy_blocked');

function responseFromBuffer({ statusCode, headers, body }) {
  return { status: statusCode, ok: statusCode >= 200 && statusCode < 300, headers, async arrayBuffer() { return body; }, async text() { return body.toString('utf8'); } };
}

function pinnedHttpsRequest({ target, address, method, headers, body, signal, timeoutMs, maxResponseBytes }) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => { if (settled) return; settled = true; fn(value); };
    const request = https.request({ hostname: address, port: 443, path: `${target.pathname}${target.search}`, method, headers, servername: target.hostname, rejectUnauthorized: true, timeout: timeoutMs }, (response) => {
      const chunks = []; let size = 0;
      response.on('data', (chunk) => { size += chunk.length; if (size > maxResponseBytes) { request.destroy(error('response_too_large', 'response_too_large')); return; } chunks.push(chunk); });
      response.on('end', () => finish(resolve, responseFromBuffer({ statusCode: response.statusCode ?? 0, headers: response.headers, body: Buffer.concat(chunks) })));
      response.on('error', (cause) => finish(reject, error(cause.message, 'upstream_unavailable')));
    });
    request.on('timeout', () => request.destroy(error('timed_out', 'timed_out')));
    request.on('error', (cause) => finish(reject, cause.errorKey ? cause : error(cause.message, cause.code === 'CERT_HAS_EXPIRED' ? 'tls_invalid' : 'network_unreachable')));
    if (signal) { if (signal.aborted) request.destroy(error('cancelled', 'cancelled')); else signal.addEventListener('abort', () => request.destroy(error('cancelled', 'cancelled')), { once: true }); }
    if (body) request.write(body);
    request.end();
  });
}

export class ProviderEgress {
  #lookup; #fetch; #allowHosts; #timeoutMs; #maxResponseBytes;
  constructor({ lookup = (host) => dns.lookup(host, { all: true }), fetchImpl, allowHosts = [], timeoutMs = DEFAULT_TIMEOUT_MS, maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES } = {}) {
    if (fetchImpl !== undefined && typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
    this.#lookup = lookup; this.#fetch = fetchImpl; this.#allowHosts = new Set(allowHosts); this.#timeoutMs = timeoutMs; this.#maxResponseBytes = maxResponseBytes;
  }
  async resolveTarget(rawUrl) {
    let url; try { url = new URL(rawUrl); } catch { throw error('endpoint_invalid', 'endpoint_invalid'); }
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) throw error('endpoint_invalid', 'endpoint_invalid');
    const host = url.hostname.toLowerCase();
    if (BLOCKED_HOSTS.has(host) || (this.#allowHosts.size > 0 && !this.#allowHosts.has(host))) throw policyError();
    const addresses = net.isIP(host) ? [{ address: host }] : await this.#lookup(host);
    const valid = addresses.map(({ address }) => address).filter((address) => !isBlockedAddress(address));
    if (valid.length === 0 || valid.length !== addresses.length) throw policyError();
    return { url, addresses: valid };
  }
  async validateTarget(rawUrl) { return (await this.resolveTarget(rawUrl)).url; }
  async request({ url, method = 'GET', headers = {}, body, signal, timeoutMs = this.#timeoutMs, maxResponseBytes = this.#maxResponseBytes }) {
    const { url: target, addresses } = await this.resolveTarget(url);
    if (this.#fetch) return this.#fetch(target, { method, headers, body, redirect: 'error', signal });
    return pinnedHttpsRequest({ target, address: addresses[0], method, headers, body, signal, timeoutMs, maxResponseBytes });
  }
}
