import { test, expect } from '@playwright/test';
import {
  W2_E2E_ENABLED,
  W2_FIXTURE,
  assertNoSecret,
  csrfHeaders,
  fixtureBoundary,
  parseSse,
  providerAccountInput,
  requestId,
  taskInput,
} from './w2-03-fixture.mjs';

test.skip(!W2_E2E_ENABLED || !process.env.REAL_ADMIN_ID || !process.env.REAL_ADMIN_CREDENTIAL, 'Set W2_E2E=1, REAL_ADMIN_ID and REAL_ADMIN_CREDENTIAL for the live W2-03 batch');

async function signIn(page) {
  await page.goto('/providers');
  await page.getByLabel('Administrator ID').fill(process.env.REAL_ADMIN_ID);
  await page.getByLabel('Credential').fill(process.env.REAL_ADMIN_CREDENTIAL);
  const response = page.waitForResponse(value => value.url().endsWith('/api/v1/identity/admin/login') && value.request().method() === 'POST');
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  const login = await response;
  const body = await login.json().catch(() => ({}));
  expect(login.status(), `login errorKey=${body.errorKey || 'none'} requestId=${body.requestId || 'none'}`).toBe(200);
}

async function api(page, path, { method = 'GET', body, expected = 200, csrf = false } = {}) {
  const result = await page.evaluate(async ({ path, method, body, csrf }) => {
    const response = await fetch(path, {
      method,
      headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(csrf ? { 'x-dgos-csrf': 'web' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let parsed = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
    return { status: response.status, body: parsed, headers: Object.fromEntries(response.headers.entries()) };
  }, { path, method, body, csrf });
  expect(result.status, `${method} ${path}: ${result.body?.errorKey || 'none'} requestId=${result.body?.requestId || result.headers['x-request-id'] || 'none'}`).toBe(expected);
  return result;
}

async function waitForTerminal(page, taskId) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const result = await api(page, `/api/v1/ai-tasks/${taskId}`);
    if (['succeeded', 'failed', 'cancelled', 'timed_out'].includes(result.body.status)) return result.body;
    await page.waitForTimeout(500);
  }
  throw new Error(`Task ${taskId} did not reach a terminal state`);
}

async function createProviderAndModel(page) {
  if (process.env.W2_PROVIDER_CONFIG_ID) return { providerConfigId: process.env.W2_PROVIDER_CONFIG_ID };
  const account = await api(page, '/api/v1/provider/accounts', { method: 'POST', body: providerAccountInput(), csrf: true, expected: 201 });
  const accountId = account.body.accountId;
  const config = await api(page, '/api/v1/provider/configs', { method: 'POST', body: { requestId: requestId(), providerAccountId: accountId, protocolType: W2_FIXTURE.protocolType, displayName: W2_FIXTURE.displayName, baseUrl: W2_FIXTURE.endpoint }, csrf: true, expected: 201 });
  const providerConfigId = config.body.id || config.body.providerConfigId;
  expect(providerConfigId).toBeTruthy();
  await api(page, `/api/v1/provider/configs/${providerConfigId}/validate`, { method: 'POST', body: { requestId: requestId() }, csrf: true, expected: 200 });
  const models = await api(page, `/api/v1/provider/configs/${providerConfigId}/models`, { method: 'POST', body: { requestId: requestId() }, csrf: true, expected: 200 });
  expect(models.body.items?.some(item => item.modelId === W2_FIXTURE.modelId || item.id === W2_FIXTURE.modelId)).toBe(true);
  await api(page, `/api/v1/provider/configs/${providerConfigId}/model-policies`, { method: 'POST', body: { requestId: requestId(), modelId: W2_FIXTURE.modelId, enabled: true, assignedCapabilities: ['text'], defaultFor: [] , baseVersion: '0' }, csrf: true, expected: 200 });
  return { accountId, providerConfigId };
}

test.describe('WP-W2-03 Web Provider to Task chain', () => {
  test('login, provider, model, task, SSE and artifact complete without secret leakage', async ({ page }) => {
    test.setTimeout(90_000);
    await signIn(page);
    const { providerConfigId } = await createProviderAndModel(page);
    const receipt = await api(page, '/api/v1/ai-tasks', { method: 'POST', body: taskInput({ providerConfigId }), csrf: true, expected: 202 });
    expect(receipt.body.taskId).toBeTruthy();
    const task = await waitForTerminal(page, receipt.body.taskId);
    expect(task.status).toBe('succeeded');
    expect(task.artifactIds?.length).toBeGreaterThan(0);
    const stream = await api(page, `/api/v1/ai-tasks/${task.taskId}/events?cursor=0`);
    const events = parseSse(typeof stream.body === 'string' ? stream.body : '');
    expect(events.length).toBeGreaterThan(0);
    expect(events.map(event => event.sequence).filter(Number.isFinite)).toEqual([...events.map(event => event.sequence).filter(Number.isFinite)].sort((a, b) => a - b));
    const artifact = await api(page, `/api/v1/artifacts/${task.artifactIds[0]}`);
    expect(artifact.body.artifactId || artifact.body.id).toBeTruthy();
    assertNoSecret({ receipt, task, artifact });
  });

  test('duplicate requestId returns the same task and does not create a second task', async ({ page }) => {
    test.setTimeout(90_000);
    await signIn(page);
    const { providerConfigId } = await createProviderAndModel(page);
    const duplicate = requestId();
    const input = taskInput({ providerConfigId, request: duplicate });
    const first = await api(page, '/api/v1/ai-tasks', { method: 'POST', body: input, csrf: true, expected: 202 });
    const replay = await api(page, '/api/v1/ai-tasks', { method: 'POST', body: input, csrf: true, expected: 202 });
    expect(replay.body.taskId).toBe(first.body.taskId);
    const task = await waitForTerminal(page, first.body.taskId);
    expect(task.taskId).toBe(first.body.taskId);
  });

  test('SSE cursor recovery is monotonic and cancellation is terminal', async ({ page }) => {
    test.setTimeout(90_000);
    await signIn(page);
    const { providerConfigId } = await createProviderAndModel(page);
    const receipt = await api(page, '/api/v1/ai-tasks', { method: 'POST', body: taskInput({ providerConfigId, prompt: 'cancel or stream recovery' }), csrf: true, expected: 202 });
    const initial = await api(page, `/api/v1/ai-tasks/${receipt.body.taskId}/events?cursor=0`);
    const events = parseSse(typeof initial.body === 'string' ? initial.body : '');
    const last = events.at(-1)?.sequence || 0;
    const resumed = await api(page, `/api/v1/ai-tasks/${receipt.body.taskId}/events?cursor=${last}`);
    const resumedEvents = parseSse(typeof resumed.body === 'string' ? resumed.body : '');
    expect(resumedEvents.every(event => !Number.isFinite(event.sequence) || event.sequence > last)).toBe(true);
    const cancelled = await api(page, `/api/v1/ai-tasks/${receipt.body.taskId}`, { method: 'DELETE', body: { requestId: requestId() }, csrf: true, expected: 200 });
    expect(['cancelled', 'succeeded', 'failed', 'timed_out']).toContain(cancelled.body.status);
  });

  test('unknown task submission has no artifact side effect', async ({ page }) => {
    await signIn(page);
    const unknown = await api(page, '/api/v1/ai-tasks', { method: 'POST', body: taskInput({ providerConfigId: 'missing-provider-config' }), csrf: true, expected: 404 });
    expect(unknown.body.errorKey).toMatch(/provider_config_not_found|model_not_found|invalid_request/);
    expect(unknown.body.artifactIds).toBeUndefined();
    expect(fixtureBoundary.kind).toBe('upstream-fixture-only');
  });
});
