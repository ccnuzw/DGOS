import dns from 'node:dns/promises';
import net from 'node:net';

const BLOCKED_HOSTS = new Set(['localhost', 'metadata.google.internal']);
const BLOCKED_IPV4 = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\./,
];

function isBlockedAddress(address) {
  if (net.isIPv4(address)) return BLOCKED_IPV4.some((pattern) => pattern.test(address));
  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    return normalized === '::1' || normalized.startsWith('fe80:') || normalized.startsWith('fc') || normalized.startsWith('fd');
  }
  return true;
}

function policyError() {
  return Object.assign(new Error('policy_blocked'), { errorKey: 'policy_blocked' });
}

export class ProviderEgress {
  #lookup;
  #fetch;
  #allowHosts;

  constructor({ lookup = (host) => dns.lookup(host, { all: true }), fetchImpl = globalThis.fetch, allowHosts = [], connect = fetchImpl } = {}) {
    if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
    this.#lookup = lookup;
    this.#fetch = fetchImpl;
    this.#allowHosts = new Set(allowHosts);
  }

  async validateTarget(rawUrl) {
    let url;
    try {
      url = new URL(rawUrl);
    } catch {
      throw Object.assign(new Error('endpoint_invalid'), { errorKey: 'endpoint_invalid' });
    }
    if (url.protocol !== 'https:' || url.username || url.password || url.port && !['443'].includes(url.port)) {
      throw Object.assign(new Error('endpoint_invalid'), { errorKey: 'endpoint_invalid' });
    }
    const host = url.hostname.toLowerCase();
    if (BLOCKED_HOSTS.has(host) || (this.#allowHosts.size > 0 && !this.#allowHosts.has(host))) throw policyError();
    const addresses = net.isIP(host) ? [{ address: host }] : await this.#lookup(host);
    if (addresses.length === 0 || addresses.some(({ address }) => isBlockedAddress(address))) throw policyError();
    return url;
  }

  async request({ url, method = 'GET', headers = {}, body, signal }) {
    const target = await this.validateTarget(url);
    const response = await this.#fetch(target, {
      method,
      headers,
      body,
      redirect: 'error',
      signal,
    });
    return response;
  }
}
