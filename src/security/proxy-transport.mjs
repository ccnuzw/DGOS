import dns from 'node:dns/promises';
import http from 'node:http';
import net from 'node:net';
import tls from 'node:tls';

const fail = (key) => Object.assign(new Error(key), { errorKey: key });
const blocked = (address) => {
  if (net.isIPv4(address)) return /^(?:0|10|127|169\.254|192\.168|19[89]|2(?:2[4-9]|[3-5]\d))\./.test(address) || /^172\.(?:1[6-9]|2\d|3[01])\./.test(address) || /^100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(address);
  if (net.isIPv6(address)) return address === '::' || address === '::1' || /^(?:fe[89ab]|f[cd][0-9a-f]|::ffff:)/i.test(address);
  return true;
};

export async function validateProxyPolicy(raw, { lookup = (host) => dns.lookup(host, { all: true }), allowLocalFixture = false } = {}) {
  const config = validateProxyConfig(raw, { allowLocalFixture });
  const host = config.url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  let addresses;
  if (net.isIP(host)) addresses = [{ address: host }];
  else {
    let timer;
    try { addresses = await Promise.race([
      lookup(host),
      new Promise((_, reject) => { timer = setTimeout(() => reject(fail('network_unreachable')), 3000); }),
    ]); } catch { throw fail('network_unreachable'); }
    finally { clearTimeout(timer); }
  }
  if (!Array.isArray(addresses) || !addresses.length || addresses.some(({ address }) => !net.isIP(address) || blocked(address) && !(allowLocalFixture && ['localhost', '127.0.0.1', '::1'].includes(host) && ['127.0.0.1', '::1'].includes(address)))) throw fail('policy_blocked');
  return config;
}

export function validateProxyConfig(raw, { allowLocalFixture = false } = {}) {
  if (!raw || typeof raw !== 'object') throw fail('proxy_configuration_invalid');
  let url;
  try { url = new URL(raw.url); } catch { throw fail('proxy_configuration_invalid'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw fail('proxy_configuration_invalid');
  if (url.protocol === 'http:' && !(allowLocalFixture && ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname))) throw fail('proxy_configuration_invalid');
  if (!Number.isInteger(Number(url.port || (url.protocol === 'https:' ? 443 : 80))) || Number(url.port || (url.protocol === 'https:' ? 443 : 80)) < 1) throw fail('proxy_configuration_invalid');
  const authorization = raw.authorization;
  if (authorization !== undefined && (typeof authorization !== 'string' || !/^Basic [A-Za-z0-9+/=]{4,512}$/.test(authorization))) throw fail('proxy_configuration_invalid');
  return { url, authorization };
}

async function connectProxy(config, { lookup, proxyCa, allowLocalFixture, timeoutMs, signal }) {
  const host = config.url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  let addresses;
  if (signal?.aborted) throw fail('cancelled');
  if (net.isIP(host)) addresses = [{ address: host }];
  else {
    addresses = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(fail('timed_out')), timeoutMs);
      const abort = () => { clearTimeout(timer); reject(fail('cancelled')); };
      signal?.addEventListener('abort', abort, { once: true });
      Promise.resolve().then(() => lookup(host)).then(
        (value) => { clearTimeout(timer); signal?.removeEventListener('abort', abort); resolve(value); },
        () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(fail('network_unreachable')); },
      );
    });
  }
  if (!Array.isArray(addresses) || !addresses.length || addresses.some(({ address }) => !net.isIP(address) || blocked(address) && !(allowLocalFixture && ['localhost', '127.0.0.1', '::1'].includes(host) && ['127.0.0.1', '::1'].includes(address)))) throw fail('policy_blocked');
  const port = Number(config.url.port || (config.url.protocol === 'https:' ? 443 : 80));
  return new Promise((resolve, reject) => {
    const socket = config.url.protocol === 'https:'
      ? tls.connect({ host: addresses[0].address, port, servername: net.isIP(host) ? undefined : host, ca: proxyCa, rejectUnauthorized: true, checkServerIdentity: (_, certificate) => tls.checkServerIdentity(host, certificate) })
      : net.connect({ host: addresses[0].address, port });
    const timer = setTimeout(() => socket.destroy(fail('timed_out')), timeoutMs);
    const abort = () => socket.destroy(fail('cancelled'));
    signal?.addEventListener('abort', abort, { once: true });
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); };
    socket.once('error', (error) => { cleanup(); reject(fail(error.errorKey ?? (config.url.protocol === 'https:' && /CERT|TLS|ALTNAME|SELF_SIGNED/i.test(error.code || '') ? 'tls_invalid' : 'network_unreachable'))); });
    socket.once(config.url.protocol === 'https:' ? 'secureConnect' : 'connect', () => { cleanup(); resolve(socket); });
  });
}

export async function proxyHttpsRequest({ target, address, proxy, lookup = (host) => dns.lookup(host, { all: true }), ca, proxyCa, allowLocalFixture = false, method = 'GET', headers = {}, body, signal, timeoutMs = 15_000, maxResponseBytes = 1_048_576, streamResponse = false }) {
  if (target.protocol !== 'https:' || !net.isIP(address)) throw fail('endpoint_invalid');
  if (signal?.aborted) throw fail('cancelled');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || !Number.isSafeInteger(maxResponseBytes) || maxResponseBytes <= 0) throw fail('endpoint_invalid');
  const deadline = Date.now() + timeoutMs;
  const remaining = () => { const ms = deadline - Date.now(); if (ms <= 0) throw fail('timed_out'); return ms; };
  const config = validateProxyConfig(proxy, { allowLocalFixture });
  const socket = await connectProxy(config, { lookup, proxyCa, allowLocalFixture, timeoutMs: remaining(), signal });
  try { remaining(); } catch (error) { socket.destroy(); throw error; }
  const targetPort = Number(target.port || 443);
  const authority = `${net.isIPv6(address) ? `[${address}]` : address}:${targetPort}`;
  let tunnel;
  let streaming = false;
  try {
    tunnel = await new Promise((resolve, reject) => {
      const agent = new http.Agent({ keepAlive: false });
      agent.createConnection = () => socket;
      const request = http.request({ method: 'CONNECT', host: config.url.hostname, port: Number(config.url.port || (config.url.protocol === 'https:' ? 443 : 80)), path: authority, agent, headers: { host: authority, ...(config.authorization ? { 'proxy-authorization': config.authorization } : {}) } });
      const timer = setTimeout(() => request.destroy(fail('timed_out')), remaining());
      const abort = () => request.destroy(fail('cancelled'));
      signal?.addEventListener('abort', abort, { once: true });
      const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); };
      request.once('connect', (response, stream, head) => { cleanup(); agent.destroy(); if (response.statusCode !== 200 || head.length) { stream.destroy(); reject(fail('network_unreachable')); } else resolve(stream); });
      request.once('error', (error) => { cleanup(); agent.destroy(); reject(fail(error.errorKey === 'cancelled' || error.errorKey === 'timed_out' ? error.errorKey : 'network_unreachable')); });
      request.end();
    });
  } catch (error) { socket.destroy(); throw error; }
  const secure = tls.connect({ socket: tunnel, servername: target.hostname, ca, rejectUnauthorized: true, checkServerIdentity: (_, certificate) => tls.checkServerIdentity(target.hostname, certificate) });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => secure.destroy(fail('timed_out')), remaining());
      const abort = () => secure.destroy(fail('cancelled'));
      signal?.addEventListener('abort', abort, { once: true });
      const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); };
      secure.once('secureConnect', () => { cleanup(); resolve(); });
      secure.once('error', (error) => { cleanup(); reject(fail(error.errorKey ?? 'tls_invalid')); });
    });
    return await new Promise((resolve, reject) => {
      const agent = new http.Agent({ keepAlive: false });
      agent.createConnection = () => secure;
      const targetHeaders = Object.fromEntries(Object.entries(headers).filter(([key]) => !/^proxy-(?:authorization|authenticate)$/i.test(key)));
      const request = http.request({ method, host: target.hostname, path: `${target.pathname}${target.search}`, agent, headers: { ...targetHeaders, host: target.host } }, (response) => {
        if (streamResponse) {
          if (response.statusCode >= 300 && response.statusCode < 400) { request.destroy(); reject(fail('policy_blocked')); return; }
          streaming = true;
          let streamFailure;
          const streamAbort = () => request.destroy(fail('cancelled'));
          const totalTimer = setTimeout(() => request.destroy(fail('timed_out')), remaining());
          signal?.addEventListener('abort', streamAbort, { once: true });
          request.once('error', (error) => { streamFailure = fail(error.errorKey ?? 'network_unreachable'); });
          response.once('error', (error) => { streamFailure ??= fail(error.errorKey ?? 'network_unreachable'); });
          request.once('close', () => { clearTimeout(totalTimer); signal?.removeEventListener('abort', streamAbort); if (!response.complete) streamFailure ??= fail('network_unreachable'); secure.destroy(); });
          const stream = async function* () {
            let size = 0;
            try {
              for await (const chunk of response) {
                if (signal?.aborted) throw fail('cancelled');
                size += chunk.length;
                if (size > maxResponseBytes) throw fail('response_too_large');
                yield chunk;
              }
              if (streamFailure) throw streamFailure;
              if (!response.complete) throw fail('network_unreachable');
            } catch (error) { throw streamFailure ?? fail(error.errorKey ?? (signal?.aborted ? 'cancelled' : 'network_unreachable')); }
            finally { clearTimeout(totalTimer); signal?.removeEventListener('abort', streamAbort); request.destroy(); agent.destroy(); secure.destroy(); }
          };
          const iterable = stream();
          const arrayBuffer = async () => { const chunks = []; for await (const chunk of iterable) chunks.push(chunk); return Buffer.concat(chunks); };
          resolve({ status: response.statusCode, ok: response.statusCode >= 200 && response.statusCode < 300, headers: response.headers, body: iterable, arrayBuffer, async text() { return (await arrayBuffer()).toString('utf8'); }, async json() { return JSON.parse(await this.text()); } });
          return;
        }
        const chunks = []; let size = 0;
        response.on('data', (chunk) => { size += chunk.length; if (size > maxResponseBytes) { request.destroy(); reject(fail('response_too_large')); } else chunks.push(chunk); });
        response.on('end', () => { if (response.statusCode >= 300 && response.statusCode < 400) reject(fail('policy_blocked')); else { const payload = Buffer.concat(chunks); resolve({ status: response.statusCode, ok: response.statusCode >= 200 && response.statusCode < 300, headers: response.headers, body: [payload], async arrayBuffer() { return payload; }, async text() { return payload.toString('utf8'); }, async json() { return JSON.parse(payload.toString('utf8')); } }); } });
        response.on('error', () => reject(fail('network_unreachable')));
        response.on('close', () => { if (!response.complete) reject(fail('network_unreachable')); });
      });
      const timer = setTimeout(() => request.destroy(fail('timed_out')), remaining());
      const abort = () => request.destroy(fail('cancelled'));
      signal?.addEventListener('abort', abort, { once: true });
      const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); };
      request.once('error', (error) => { cleanup(); reject(fail(error.errorKey ?? 'network_unreachable')); });
      request.once('close', () => { cleanup(); agent.destroy(); });
      if (body) request.write(body);
      request.end();
    });
  } finally { if (!streaming) secure.destroy(); }
}
