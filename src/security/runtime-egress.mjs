import { ProviderEgress } from './provider-egress.mjs';

// Explicit local integration transport. Only the synthetic fixture origin is mapped.
export function createRuntimeEgress(env = process.env) {
  const allowHosts = typeof env.DGOS_PROVIDER_ALLOW_HOSTS === 'string'
    ? env.DGOS_PROVIDER_ALLOW_HOSTS.split(',').map((host) => host.trim().toLowerCase()).filter(Boolean)
    : [];
  if (!env.DGOS_FIXTURE_BASE_URL) return new ProviderEgress({ allowHosts });
  if (env.NODE_ENV === 'production' || env.DGOS_ALLOW_INSECURE_FIXTURE !== '1') throw new Error('fixture_transport_not_allowed');
  const base = new URL(env.DGOS_FIXTURE_BASE_URL);
  if (base.protocol !== 'http:' || !['127.0.0.1', 'localhost', 'fixture'].includes(base.hostname)) throw new Error('fixture_endpoint_invalid');
  const validateTarget = async (url) => {
    const source = new URL(url);
    if (source.username || source.password || source.origin !== 'https://fixture.test' || !(source.pathname === '/v1' || source.pathname.startsWith('/v1/'))) throw new Error('fixture_origin_denied');
    return source;
  };
  return {
    validateTarget,
    async request({ url, timeoutMs = 15000, signal, maxBytes, ...init }) {
      const source = await validateTarget(url);
      return fetch(new URL(source.pathname + source.search, base), { ...init, redirect: 'error', signal: AbortSignal.any([AbortSignal.timeout(timeoutMs), ...(signal ? [signal] : [])]) });
    },
  };
}
