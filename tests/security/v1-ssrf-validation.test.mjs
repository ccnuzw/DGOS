import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ProviderEgress } from '../../src/security/provider-egress.mjs';

test('SSRF - blocks private IP addresses', async (t) => {
  const egress = new ProviderEgress();

  const privateIPs = [
    'http://127.0.0.1/admin',
    'http://localhost/secret',
    'http://10.0.0.1/internal',
    'http://172.16.0.1/metadata',
    'http://192.168.1.1/config',
    'http://169.254.169.254/latest/meta-data/', // AWS metadata
    'http://[::1]/admin', // IPv6 loopback
    'http://[fd00::1]/internal', // IPv6 private
  ];

  for (const url of privateIPs) {
    await assert.rejects(
      async () => egress.validateTarget(url),
      (error) => {
        assert.ok(error.message.includes('forbidden') || error.message.includes('invalid'));
        return true;
      },
      `Should reject private IP: ${url}`
    );
  }
});

test('SSRF - allows public endpoints', async (t) => {
  const egress = new ProviderEgress();

  const publicURLs = [
    'https://api.openai.com/v1/chat/completions',
    'https://api.anthropic.com/v1/messages',
    'https://example.com/api',
  ];

  for (const url of publicURLs) {
    await assert.doesNotReject(
      async () => egress.validateTarget(url),
      `Should allow public URL: ${url}`
    );
  }
});

test('SSRF - blocks redirect to private IPs', async (t) => {
  const egress = new ProviderEgress();

  // Test URL parsing edge cases
  const trickURLs = [
    'http://127.1', // Shortened IP notation
    'http://2130706433', // Decimal IP (127.0.0.1)
    'http://0x7f000001', // Hex IP (127.0.0.1)
  ];

  for (const url of trickURLs) {
    await assert.rejects(
      async () => egress.validateTarget(url),
      (error) => {
        assert.ok(error.message.includes('forbidden') || error.message.includes('invalid'));
        return true;
      },
      `Should reject obfuscated private IP: ${url}`
    );
  }
});

test('SSRF - validates protocol', async (t) => {
  const egress = new ProviderEgress();

  const invalidProtocols = [
    'file:///etc/passwd',
    'ftp://example.com/file',
    'gopher://example.com',
    'data:text/html,<script>alert(1)</script>',
  ];

  for (const url of invalidProtocols) {
    await assert.rejects(
      async () => egress.validateTarget(url),
      (error) => {
        assert.ok(error.message.includes('invalid') || error.message.includes('forbidden'));
        return true;
      },
      `Should reject non-HTTP(S) protocol: ${url}`
    );
  }
});

test('SSRF - network route validates targets before requests', async (t) => {
  const { createNetworkRouteFactory } = await import('../../src/security/network-route.mjs');
  const egress = new ProviderEgress();
  const route = createNetworkRouteFactory({ egress });

  // Attempt request to private IP should fail validation
  await assert.rejects(
    async () => route.request({ url: 'http://127.0.0.1/admin', method: 'GET' }),
    (error) => {
      assert.ok(error.message.includes('forbidden') || error.message.includes('invalid'));
      return true;
    },
    'Network route should validate and block private IPs'
  );
});

test('Input validation - URL parameter sanitization', async (t) => {
  const egress = new ProviderEgress();

  const malformedURLs = [
    'not-a-url',
    'ht!tp://example.com',
    'https://example.com:99999', // Invalid port
    'https://', // Incomplete
    '',
    null,
    undefined,
  ];

  for (const url of malformedURLs) {
    await assert.rejects(
      async () => egress.validateTarget(url),
      `Should reject malformed URL: ${url}`
    );
  }
});
