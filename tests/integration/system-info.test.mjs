import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildServer } from '../../apps/api/src/server.mjs';

test('GET /api/v1/system/info returns system information', async () => {
  const server = buildServer({ logger: false });
  await server.ready();

  try {
    // Bootstrap admin
    const bootstrap = await server.inject({
      method: 'POST',
      url: '/api/v1/identity/admin/bootstrap',
      payload: { credential: 'test-password', displayName: 'Admin' },
    });
    assert.equal(bootstrap.statusCode, 201);
    const { sessionId } = JSON.parse(bootstrap.body);

    // Get system info
    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/system/info',
      headers: { cookie: `dgos_session=${sessionId}` },
    });

    if (response.statusCode !== 200) {
      console.log('Response status:', response.statusCode);
      console.log('Response body:', response.body);
      const errorData = JSON.parse(response.body);
      console.log('Error:', errorData);
    }
    assert.equal(response.statusCode, 200);
    const data = JSON.parse(response.body);

    // Verify system section
    assert.ok(data.system, 'Should have system section');
    assert.ok(data.system.version, 'Should have DGOS version');
    assert.ok(data.system.apiVersion, 'Should have API version');
    assert.ok(data.system.nodeVersion, 'Should have Node.js version');
    assert.ok(data.system.platform, 'Should have platform');
    assert.equal(typeof data.system.uptime, 'number', 'Should have uptime as number');

    // Verify resources section
    assert.ok(data.resources, 'Should have resources section');
    assert.equal(typeof data.resources.cpuUsage, 'number', 'Should have CPU usage');
    assert.equal(typeof data.resources.cpuCount, 'number', 'Should have CPU count');
    assert.equal(typeof data.resources.memoryUsed, 'number', 'Should have memory used');
    assert.equal(typeof data.resources.memoryTotal, 'number', 'Should have memory total');
    assert.equal(typeof data.resources.heapUsed, 'number', 'Should have heap used');
    assert.equal(typeof data.resources.heapTotal, 'number', 'Should have heap total');

    // Verify services section
    assert.ok(data.services, 'Should have services section');
    assert.ok(data.services.api, 'Should have API service status');
    assert.equal(data.services.api.status, 'active', 'API should be active');
    assert.ok(data.services.database, 'Should have database status');
    assert.ok(data.services.redis, 'Should have Redis status');

    // Verify network section
    assert.ok(data.network, 'Should have network section');
    assert.ok(data.network.proxyMode, 'Should have proxy mode');
    assert.equal(typeof data.network.restartRequired, 'boolean', 'Should have restart required flag');

    // Verify apps section
    assert.ok(data.apps, 'Should have apps section');
    assert.equal(typeof data.apps.installedCount, 'number', 'Should have installed apps count');
    assert.equal(typeof data.apps.runningCount, 'number', 'Should have running apps count');

    // Verify sessions section
    assert.ok(data.sessions, 'Should have sessions section');
    assert.equal(typeof data.sessions.activeCount, 'number', 'Should have active sessions count');
    assert.equal(typeof data.sessions.totalUsers, 'number', 'Should have total users count');

    // Verify storage section
    assert.ok(data.storage, 'Should have storage section');
    assert.ok(data.storage.databaseType, 'Should have database type');
  } finally {
    await server.close();
  }
});

test('GET /api/v1/system/info requires authentication', async () => {
  const server = buildServer({ logger: false });
  await server.ready();

  try {
    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/system/info',
    });

    assert.equal(response.statusCode, 401);
    const data = JSON.parse(response.body);
    assert.equal(data.errorKey, 'session_invalid');
  } finally {
    await server.close();
  }
});

test('GET /api/v1/system/info with API key authentication', async () => {
  const server = buildServer({ logger: false });
  await server.ready();

  try {
    // Bootstrap admin
    const bootstrap = await server.inject({
      method: 'POST',
      url: '/api/v1/identity/admin/bootstrap',
      payload: { credential: 'test-password', displayName: 'Admin' },
    });
    assert.equal(bootstrap.statusCode, 201);
    const { sessionId } = JSON.parse(bootstrap.body);

    // Create API key with system.settings.read scope
    const keyResponse = await server.inject({
      method: 'POST',
      url: '/api/v1/secret/api-keys',
      headers: {
        cookie: `dgos_session=${sessionId}`,
        'x-dgos-csrf': '1'
      },
      payload: {
        requestId: crypto.randomUUID(),
        name: 'Test Key',
        scopes: ['system.settings.read'],
      },
    });
    assert.equal(keyResponse.statusCode, 201);
    const { secret } = JSON.parse(keyResponse.body);

    // Use API key to access system info
    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/system/info',
      headers: { authorization: `ApiKey ${secret}` },
    });

    assert.equal(response.statusCode, 200);
    const data = JSON.parse(response.body);
    assert.ok(data.system, 'Should have system section');
  } finally {
    await server.close();
  }
});
