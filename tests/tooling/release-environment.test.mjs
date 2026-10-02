import test from 'node:test';
import assert from 'node:assert/strict';
import { integrationEnvironment } from '../../scripts/release-environment.mjs';

test('integration destructive commands use a dedicated project and database', () => {
  const config = integrationEnvironment({});
  assert.deepEqual(config.composeArgs, ['compose', '-p', 'dgos-v1-integration', '-f', 'docker-compose.integration.yml']);
  assert.equal(new URL(config.databaseUrl).pathname, '/dgos_v1_integrated');
  assert.equal(config.webUrl, 'http://127.0.0.1:15203');
  assert.throws(() => integrationEnvironment({ DGOS_INTEGRATION_PROJECT: 'dgos' }), /dedicated Compose/);
  assert.throws(() => integrationEnvironment({ DGOS_INTEGRATION_PROJECT: 'dgos-release' }), /dedicated Compose/);
});

test('integration ports reject other workers, invalid values and collisions', () => {
  for (const value of ['15133', '5432', '15203.5', 'NaN', '']) {
    assert.throws(() => integrationEnvironment({ DGOS_INTEGRATION_WEB_PORT: value }), /assigned ports/);
  }
  assert.throws(() => integrationEnvironment({ DGOS_INTEGRATION_WEB_PORT: '15200' }), /distinct/);
  const config = integrationEnvironment({ DGOS_INTEGRATION_WEB_PORT: '15220', DGOS_INTEGRATION_PROJECT: 'dgos-v1-integration-r2' });
  assert.equal(config.webUrl, 'http://127.0.0.1:15220');
  assert.equal(config.composeArgs[2], 'dgos-v1-integration-r2');
});
