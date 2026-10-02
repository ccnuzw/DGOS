import { BlockList, isIP } from 'node:net';

const loopback = (address) => address === '::1' || address === '127.0.0.1';
const addressOf = (value) => {
  if (typeof value !== 'string') return null;
  const address = value.startsWith('::ffff:') && isIP(value.slice(7)) === 4 ? value.slice(7) : value;
  return isIP(address) ? address : null;
};
const header = (headers, name) => {
  const value = headers?.[name];
  return typeof value === 'string' && value.length > 0 && !/[\s,\r\n]/.test(value) ? value : null;
};
const origin = (value, scheme) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new Error('transport_origin_invalid');
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error('transport_origin_invalid'); }
  if (parsed.protocol !== `${scheme}:` || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.origin !== value || !parsed.hostname) throw new Error('transport_origin_invalid');
  return parsed;
};
const cidrList = (entries) => {
  if (!Array.isArray(entries)) throw new Error('trusted_proxy_cidrs_invalid');
  const list = new BlockList();
  for (const entry of entries) {
    if (typeof entry !== 'string' || !entry || entry.trim() !== entry) throw new Error('trusted_proxy_cidrs_invalid');
    const match = /^([^/]+)(?:\/([0-9]{1,3}))?$/.exec(entry);
    const family = isIP(match?.[1] ?? '');
    const bits = family === 4 ? 32 : 128;
    const prefix = match?.[2] === undefined ? bits : Number(match[2]);
    if (!family || !Number.isInteger(prefix) || prefix < 1 || prefix > bits) throw new Error('trusted_proxy_cidrs_invalid');
    list.addSubnet(match[1], prefix, family === 4 ? 'ipv4' : 'ipv6');
  }
  return { list, configured: entries.length > 0 };
};

// The ingress must overwrite forwarded proto/host and keep the API unreachable from untrusted peers.
export function createRequestTransportPolicy({ publicOrigin, trustedProxyCidrs = [], nativeLocalOrigin, fixtureLocalOrigin, allowInsecureFixture = false, nodeEnv = process.env.NODE_ENV } = {}) {
  const publicUrl = origin(publicOrigin, 'https');
  const nativeUrl = origin(nativeLocalOrigin, 'http');
  const fixtureUrl = origin(fixtureLocalOrigin, 'http');
  if (nativeUrl && !loopback(nativeUrl.hostname)) throw new Error('native_local_origin_invalid');
  if (fixtureUrl && !loopback(fixtureUrl.hostname)) throw new Error('fixture_local_origin_invalid');
  if (allowInsecureFixture && nodeEnv === 'production') throw new Error('fixture_transport_not_allowed');
  if (allowInsecureFixture && !fixtureUrl) throw new Error('fixture_local_origin_required');
  const trusted = cidrList(trustedProxyCidrs);
  if (trusted.configured && !publicUrl) throw new Error('public_origin_required');
  const isTrustedProxy = (value) => {
    const address = addressOf(value);
    return Boolean(address && trusted.list.check(address, isIP(address) === 4 ? 'ipv4' : 'ipv6'));
  };
  const trustProxy = (address, hop) => hop === 0 && isTrustedProxy(address);
  const trustedTransport = (request) => {
    const raw = request?.raw ?? request;
    const socket = raw?.socket;
    const peer = addressOf(socket?.remoteAddress);
    const local = addressOf(socket?.localAddress);
    const host = header(raw?.headers, 'host');
    if (!peer || !host) return false;
    const forwardedProto = raw.headers?.['x-forwarded-proto'];
    const forwardedHost = raw.headers?.['x-forwarded-host'];
    const forwardedPort = raw.headers?.['x-forwarded-port'];
    const forwardedSsl = raw.headers?.['x-forwarded-ssl'];
    if (socket.encrypted === true) {
      return Boolean(publicUrl && host === publicUrl.host && forwardedProto === undefined && forwardedHost === undefined && forwardedPort === undefined && forwardedSsl === undefined);
    }
    if (isTrustedProxy(peer) && publicUrl) {
      return host === publicUrl.host && header(raw.headers, 'x-forwarded-proto') === 'https' && header(raw.headers, 'x-forwarded-host') === publicUrl.host && forwardedPort === undefined && forwardedSsl === undefined;
    }
    if (!loopback(peer) || !loopback(local) || forwardedProto !== undefined || forwardedHost !== undefined || forwardedPort !== undefined || forwardedSsl !== undefined) return false;
    const localPort = socket.localPort;
    const approved = [nativeUrl, allowInsecureFixture && nodeEnv !== 'production' ? fixtureUrl : null].filter(Boolean);
    return approved.some((url) => host === url.host && localPort === Number(url.port || 80));
  };
  return { trustProxy, trustedTransport };
}
