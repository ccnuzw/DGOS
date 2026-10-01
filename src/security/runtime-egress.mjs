import { ProviderEgress } from './provider-egress.mjs';

// Explicit local integration transport. Only the synthetic fixture origin is mapped.
export function createRuntimeEgress(env = process.env) {
  if (!env.DGOS_FIXTURE_BASE_URL) return new ProviderEgress();
  if (env.NODE_ENV === 'production' || env.DGOS_ALLOW_INSECURE_FIXTURE !== '1') throw new Error('fixture_transport_not_allowed');
  const base = new URL(env.DGOS_FIXTURE_BASE_URL);
  if (base.protocol !== 'http:' || !['127.0.0.1', 'localhost', 'fixture'].includes(base.hostname)) throw new Error('fixture_endpoint_invalid');
  return {
    async request({ url, timeoutMs = 15000, signal, maxBytes, ...init }) {
      const source = new URL(url);
      if (source.origin !== 'https://fixture.test' || !source.pathname.startsWith('/v1/')) throw new Error('fixture_origin_denied');
      return fetch(new URL(source.pathname + source.search, base), { ...init, redirect: 'error', signal: AbortSignal.any([AbortSignal.timeout(timeoutMs), ...(signal ? [signal] : [])]) });
    },
  };
}
