import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestTransportPolicy } from '../../src/security/request-transport.mjs';

const request = ({ peer = '198.51.100.8', local = '10.0.0.5', port = 3000, encrypted = false, host = 'dgos.example', headers = {} } = {}) => ({
  raw: { socket: { remoteAddress: peer, localAddress: local, localPort: port, encrypted }, headers: { host, ...headers } },
});
const forwarded = { 'x-forwarded-proto': 'https', 'x-forwarded-host': 'dgos.example' };

test('trusted single-hop ingress requires declared peer and exact public HTTPS origin', () => {
  const policy = createRequestTransportPolicy({ publicOrigin: 'https://dgos.example', trustedProxyCidrs: ['10.42.0.0/24'], nodeEnv: 'production' });
  assert.equal(policy.trustProxy('10.42.0.4', 0), true);
  assert.equal(policy.trustProxy('::ffff:10.42.0.4', 0), true);
  assert.equal(policy.trustProxy('10.42.0.4', 1), false);
  assert.equal(policy.trustProxy('198.51.100.8', 0), false);
  assert.equal(policy.trustedTransport(request({ peer: '10.42.0.4', headers: forwarded })), true);
  assert.equal(policy.trustedTransport(request({ headers: { ...forwarded, 'x-native-secret-boundary': 'trusted' } })), false);
  assert.equal(policy.trustedTransport(request({ peer: '10.42.0.4', headers: { ...forwarded, 'x-forwarded-proto': 'http' } })), false);
  assert.equal(policy.trustedTransport(request({ peer: '10.42.0.4', headers: { ...forwarded, 'x-forwarded-proto': 'https,http' } })), false);
  assert.equal(policy.trustedTransport(request({ peer: '10.42.0.4', headers: { ...forwarded, 'x-forwarded-host': 'evil.example' } })), false);
  assert.equal(policy.trustedTransport(request({ peer: '10.42.0.4', host: 'evil.example', headers: forwarded })), false);
  assert.equal(policy.trustedTransport(request({ peer: '10.42.0.4', headers: { ...forwarded, 'x-forwarded-port': '443' } })), false);
  assert.equal(policy.trustedTransport(request({ peer: '10.42.0.4', headers: { ...forwarded, 'x-forwarded-ssl': 'on' } })), false);
});

test('missing or malformed deployment config fails closed', () => {
  const empty = createRequestTransportPolicy({ nodeEnv: 'production' });
  assert.equal(empty.trustedTransport(request({ headers: forwarded })), false);
  assert.equal(empty.trustProxy('10.42.0.4', 0), false);
  assert.throws(() => createRequestTransportPolicy({ trustedProxyCidrs: ['10.42.0.0/24'] }), /public_origin_required/);
  assert.throws(() => createRequestTransportPolicy({ publicOrigin: 'http://dgos.example' }), /transport_origin_invalid/);
  assert.throws(() => createRequestTransportPolicy({ publicOrigin: 'https://dgos.example/path' }), /transport_origin_invalid/);
  assert.throws(() => createRequestTransportPolicy({ publicOrigin: 'https://dgos.example', trustedProxyCidrs: ['0.0.0.0/0'] }), /trusted_proxy_cidrs_invalid/);
  assert.throws(() => createRequestTransportPolicy({ publicOrigin: 'https://dgos.example', trustedProxyCidrs: ['10.0.0.0/999'] }), /trusted_proxy_cidrs_invalid/);
});

test('direct TLS socket is secure only for configured public host', () => {
  const policy = createRequestTransportPolicy({ publicOrigin: 'https://dgos.example', nodeEnv: 'production' });
  assert.equal(policy.trustedTransport(request({ encrypted: true })), true);
  assert.equal(policy.trustedTransport(request({ encrypted: true, host: 'evil.example' })), false);
  assert.equal(policy.trustedTransport(request({ encrypted: true, headers: forwarded })), false);
  assert.equal(policy.trustedTransport(request({ encrypted: false, headers: forwarded })), false);
});

test('explicit native local API checks socket peer, local address, host and port', () => {
  const policy = createRequestTransportPolicy({ nativeLocalOrigin: 'http://127.0.0.1:15125', nodeEnv: 'production' });
  const local = { peer: '127.0.0.1', local: '127.0.0.1', port: 15125, host: '127.0.0.1:15125' };
  assert.equal(policy.trustedTransport(request(local)), true);
  assert.equal(policy.trustedTransport(request({ ...local, peer: '10.0.0.2' })), false);
  assert.equal(policy.trustedTransport(request({ ...local, local: '0.0.0.0' })), false);
  assert.equal(policy.trustedTransport(request({ ...local, port: 3000 })), false);
  assert.equal(policy.trustedTransport(request({ ...local, headers: { 'x-forwarded-proto': 'https' } })), false);
  assert.equal(policy.trustedTransport(request({ ...local, headers: { 'x-native-secret-boundary': 'trusted' } })), true);
  assert.throws(() => createRequestTransportPolicy({ nativeLocalOrigin: 'http://10.0.0.2:15125' }), /native_local_origin_invalid/);
});

test('insecure local fixture requires nonproduction explicit origin', () => {
  const fixture = createRequestTransportPolicy({ allowInsecureFixture: true, fixtureLocalOrigin: 'http://127.0.0.1:15126', nodeEnv: 'test' });
  assert.equal(fixture.trustedTransport(request({ peer: '127.0.0.1', local: '127.0.0.1', port: 15126, host: '127.0.0.1:15126' })), true);
  assert.throws(() => createRequestTransportPolicy({ allowInsecureFixture: true, fixtureLocalOrigin: 'http://127.0.0.1:15126', nodeEnv: 'production' }), /fixture_transport_not_allowed/);
  assert.throws(() => createRequestTransportPolicy({ allowInsecureFixture: true, nodeEnv: 'test' }), /fixture_local_origin_required/);
});
