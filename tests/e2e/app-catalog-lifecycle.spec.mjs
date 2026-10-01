import test from 'node:test';
import assert from 'node:assert/strict';
test('V1-E2E-02 app catalog lifecycle asset', async (t) => {
  if (!process.env.DGOS_E2E_URL) return t.skip('DGOS_E2E_URL is required for Web E2E');
  const response = await fetch(`${process.env.DGOS_E2E_URL}/api/v1/apps`);
  assert.equal(response.ok, true);
});
