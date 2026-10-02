import { test, expect } from '@playwright/test';

test.skip(!process.env.REAL_ADMIN_ID || !process.env.REAL_ADMIN_CREDENTIAL, 'Set real integration administrator credentials');

test('real API login, settings, provider and task recovery', async ({ page }) => {
  await page.goto('/settings');
  await page.getByLabel('Administrator ID').fill(process.env.REAL_ADMIN_ID);
  await page.getByLabel('Credential').fill(process.env.REAL_ADMIN_CREDENTIAL);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await expect(page.locator('form select[name="appearanceMode"]')).toBeVisible();
  const before = await page.evaluate(async () => { const response = await fetch('/api/v1/system/settings'); return { status: response.status, body: await response.json() }; });
  expect(before.status).toBe(200);
  expect(before.body.settings).toBeUndefined();
  expect(before.body.appearance.appearanceMode).toMatch(/light|dark|system/);
  const settingPatch = page.waitForResponse(response => response.url().endsWith('/api/v1/system/settings') && response.request().method() === 'PATCH');
  await page.locator('form').filter({ has: page.locator('select[name="appearanceMode"]') }).getByRole('button', { name: 'Save changes' }).click();
  const updated = await settingPatch;
  expect(updated.status()).toBe(200);
  const patchInput = updated.request().postDataJSON();
  expect(patchInput).toMatchObject({ baseVersion: before.body.settingsVersion, domain: 'appearance' });
  expect(patchInput.patch.domain).toBeUndefined();
  expect((await updated.json()).appearance).toBeTruthy();
  const conflict = await page.evaluate(async stale => { const response = await fetch('/api/v1/system/settings', { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-dgos-csrf': 'web' }, body: JSON.stringify({ requestId: crypto.randomUUID(), baseVersion: stale, domain: 'appearance', patch: { displayScale: 1 } }) }); return { status: response.status, body: await response.json() }; }, before.body.settingsVersion);
  expect(conflict.status).toBe(409);
  await page.getByLabel('Choose').selectOption('appPermissions');
  await page.getByLabel('App ID').fill('dgos.ai-workbench');
  await page.getByLabel('Capability').fill('dgos.model.list');
  await page.locator('select[name="decision"]').selectOption('allow');
  const permissionPatch = page.waitForResponse(response => response.url().endsWith('/api/v1/system/settings') && response.request().method() === 'PATCH');
  await page.locator('form').filter({ has: page.locator('input[name="capability"]') }).getByRole('button', { name: 'Save changes' }).click();
  const permissionResult = await permissionPatch;
  const permissionInput = permissionResult.request().postDataJSON();
  expect(permissionInput).toMatchObject({ domain: 'appPermissions', patch: { rules: [{ appId: 'dgos.ai-workbench', subjectType: 'user', subjectId: process.env.REAL_ADMIN_ID, capability: 'dgos.model.list', scope: { value: '*' }, decision: 'allow' }] } });
  expect(typeof permissionInput.baseVersion).toBe('string');
  expect(typeof permissionInput.requestId).toBe('string');
  if (permissionResult.status() !== 200) {
    const failure = await permissionResult.json().catch(() => ({}));
    throw new Error(`Permission settings PATCH failed: HTTP ${permissionResult.status()}, errorKey=${failure.errorKey || 'unavailable'}, httpRequestId=${failure.requestId || 'unavailable'}, bodyRequestId=${permissionInput.requestId}`);
  }
  expect(Array.isArray((await permissionResult.json()).appPermissions)).toBe(true);
});

test('real API catalog, protocols, providers and existing task recovery', async ({ page }) => {
  await page.goto('/catalog');
  await page.getByLabel('Administrator ID').fill(process.env.REAL_ADMIN_ID);
  await page.getByLabel('Credential').fill(process.env.REAL_ADMIN_CREDENTIAL);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await page.getByRole('link', { name: 'App catalog' }).click();
  await expect(page.getByRole('heading', { name: 'App catalog', level: 1 })).toBeVisible();
  const catalog = await page.evaluate(async () => { const response = await fetch('/api/v1/apps'); return { status: response.status, body: await response.json() }; });
  expect(catalog.status).toBe(200);
  expect(Array.isArray(catalog.body.items)).toBe(true);
  await page.getByRole('link', { name: 'Protocol center' }).click();
  await expect(page.getByRole('heading', { name: 'Capability protocols' })).toBeVisible();
  const protocols = await page.evaluate(async () => { const response = await fetch('/api/v1/provider/capability-protocols'); return { status: response.status, body: await response.json() }; });
  expect(protocols.status).toBe(200);
  expect(Array.isArray(protocols.body.items)).toBe(true);
  await page.getByRole('link', { name: 'Providers' }).click();
  await expect(page.getByRole('heading', { name: 'Providers', level: 1 })).toBeVisible();
  await page.getByRole('link', { name: 'AI Workbench' }).click();
  await expect(page.getByRole('button', { name: 'Open installed AI workbench' })).toBeVisible();
  if (process.env.REAL_TASK_ID) {
    await page.evaluate(taskId => localStorage.setItem('dgos.ui.taskId', taskId), process.env.REAL_TASK_ID);
    await page.reload();
    await expect(page.getByText(`Task ID: ${process.env.REAL_TASK_ID}`)).toBeVisible();
    await page.getByRole('button', { name: 'Re-query / resume' }).last().click();
    await expect(page.locator('.dgos-status').last()).toContainText(/succeeded|failed|cancelled|needs_review/);
  }
});

test('real signed package launches through the sandbox bridge and completes a task', async ({ page }) => {
  test.skip(process.env.REAL_PACKAGE !== '1', 'Set REAL_PACKAGE=1 after the signed package fixture is installed and granted');
  const browserErrors = [];
  const bridgeCalls = [];
  page.on('console', message => { if (message.type() === 'error') browserErrors.push(message.text()); });
  page.on('pageerror', error => browserErrors.push(error.message));
  page.on('response', async response => { if (response.url().endsWith('/api/v1/apps/dgos.ai-workbench/bridge')) bridgeCalls.push({ capability: response.request().postDataJSON()?.capability, status: response.status(), errorKey: response.ok() ? undefined : (await response.json().catch(() => ({}))).errorKey }); });
  await page.goto('/catalog');
  await page.getByLabel('Administrator ID').fill(process.env.REAL_ADMIN_ID);
  await page.getByLabel('Credential').fill(process.env.REAL_ADMIN_CREDENTIAL);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  const app = page.locator('.record-list li').filter({ hasText: 'dgos.ai-workbench' });
  await expect(app).toBeVisible();
  await app.getByRole('button', { name: 'Launch' }).click();
  const iframe = page.frameLocator('iframe[title="dgos.ai-workbench"]');
  await expect(page.locator('iframe[title="dgos.ai-workbench"]')).toHaveAttribute('sandbox', 'allow-scripts');
  await expect(iframe.getByRole('heading', { name: 'AI Workbench' })).toBeVisible();
  try {
    await expect(iframe.locator('#status')).not.toHaveText('Connecting', { timeout: 8000 });
  } catch (error) {
    const frameState = await iframe.locator('body').evaluate(() => ({ status: document.querySelector('#status')?.textContent, scriptCount: document.scripts.length }));
    throw new Error(`Iframe did not handshake: ${JSON.stringify({ frameState, errorCount: browserErrors.length })}`, { cause: error });
  }
  await expect(iframe.locator('#model option')).not.toHaveCount(1, { timeout: 10000 });
  const modelValue = await iframe.locator('#model option').nth(1).getAttribute('value');
  expect(modelValue).toBeTruthy();
  await iframe.getByLabel('Model').selectOption(modelValue);
  await iframe.getByLabel('Prompt').fill('hello from signed package');
  await iframe.getByRole('button', { name: 'Run task' }).click();
  try { await expect(iframe.locator('#status')).toHaveText('succeeded', { timeout: 20000 }); }
  catch (error) { throw new Error(`Package task did not succeed: ${JSON.stringify(bridgeCalls)}`, { cause: error }); }
  await expect(iframe.locator('#result')).toContainText('hello world');
  await expect(iframe.locator('#artifacts button').first()).toBeVisible();
  await iframe.locator('#artifacts button').first().click();
  await expect(iframe.locator('#artifacts pre')).toContainText('hello world');
});

test('real package bridge recovers an existing task and artifact without resubmitting', async ({ page }) => {
  test.skip(process.env.REAL_PACKAGE !== '1' || !process.env.REAL_TASK_ID, 'Set REAL_PACKAGE=1 and REAL_TASK_ID for an existing task');
  const calls = [];
  const resolutions = [];
  page.on('request', request => { if (request.url().endsWith('/api/v1/apps/dgos.ai-workbench/bridge')) calls.push(request.postDataJSON()?.capability); });
  page.on('response', async response => {
    if (response.url().endsWith('/api/v1/apps/dgos.ai-workbench/bridge') && response.request().postDataJSON()?.capability === 'dgos.model.resolve') {
      const body = await response.json().catch(() => ({}));
      resolutions.push({ status: response.status(), errorKey: body.errorKey, parameters: body.uiSchemas?.parameters ?? [] });
    }
  });
  await page.goto('/catalog');
  await page.getByLabel('Administrator ID').fill(process.env.REAL_ADMIN_ID);
  await page.getByLabel('Credential').fill(process.env.REAL_ADMIN_CREDENTIAL);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  const app = page.locator('.record-list li').filter({ hasText: 'dgos.ai-workbench' });
  await expect(app).toBeVisible();
  const deployment = await page.evaluate(async () => { const response = await fetch('/api/v1/apps/dgos.ai-workbench/deployment'); return { status: response.status, body: await response.json() }; });
  expect(deployment.status).toBe(200);
  expect(deployment.body.versionNumber).toBe(2);
  await app.getByRole('button', { name: 'Launch' }).click();
  const iframe = page.frameLocator('iframe[title="dgos.ai-workbench"]');
  await expect(page.locator('iframe[title="dgos.ai-workbench"]')).toHaveAttribute('sandbox', 'allow-scripts');
  await expect(iframe.locator('#status')).not.toHaveText('Connecting', { timeout: 10000 });
  await expect.poll(() => calls.filter(capability => capability === 'dgos.system.context.read').length).toBeGreaterThan(0);
  await expect.poll(() => calls.filter(capability => capability === 'dgos.model.list').length).toBeGreaterThan(0);
  await expect.poll(() => calls.filter(capability => capability === 'dgos.system.context.events').length, { timeout: 8000 }).toBeGreaterThan(0);
  await expect(iframe.locator('#model option')).not.toHaveCount(1);
  const firstModel = await iframe.locator('#model option').nth(1).getAttribute('value');
  await iframe.locator('#model').selectOption(firstModel);
  await expect.poll(() => calls.filter(capability => capability === 'dgos.model.resolve').length).toBeGreaterThan(0);
  await expect.poll(() => resolutions.length).toBeGreaterThan(0);
  expect(resolutions[0].status).toBe(200);
  for (const parameter of resolutions[0].parameters.filter(value => ['temperature', 'maxOutputTokens'].includes(value))) await expect(iframe.locator(`#parameters input[name="${parameter}"]`)).toBeVisible();
  await iframe.locator('#task-id').fill(process.env.REAL_TASK_ID);
  await iframe.locator('#resume').click();
  await expect(iframe.locator('#result')).toContainText('hello world');
  await expect(iframe.locator('#artifacts button').first()).toBeVisible();
  await iframe.locator('#artifacts button').first().click();
  await expect(iframe.locator('#artifacts pre')).toContainText('hello world');
  await page.getByLabel('Task ID').last().fill(process.env.REAL_TASK_ID);
  await page.getByRole('button', { name: 'Re-query / resume' }).click();
  await expect(page.locator('.task-output').first()).toContainText('hello world');
  await page.getByRole('button', { name: 'Close' }).last().click();
  await app.getByRole('button', { name: 'Launch' }).click();
  await expect(page.locator('iframe[title="dgos.ai-workbench"]')).toBeVisible();
  await page.getByLabel('Task ID').last().fill(process.env.REAL_TASK_ID);
  await page.getByRole('button', { name: 'Re-query / resume' }).click();
  await expect(page.locator('.task-output').first()).toContainText('hello world');
  expect(calls).toContain('dgos.aiTask.get');
  expect(calls).toContain('dgos.aiTask.events');
  expect(calls).toContain('dgos.artifact.read');
  expect(calls).not.toContain('dgos.aiTask.submit');
});

test('real signed workbench submits one parameter task through a dedicated profile and restores it', async ({ page }) => {
  test.skip(process.env.REAL_PARAMETER_TASK !== '1', 'Set REAL_PARAMETER_TASK=1 for the one-time dedicated profile run');
  test.setTimeout(90_000);
  const runMarker = `ui-r5-parameter-${Date.now()}`;
  const before = await (await fetch('http://127.0.0.1:15204/__fixture')).json();
  const upstreamBefore = before.requests.filter(item => item.path === '/v1/chat/completions').length;
  const submits = [], deltas = [], modelLists = [];
  page.on('response', async response => {
    if (!response.url().endsWith('/api/v1/apps/dgos.ai-workbench/bridge')) return;
    const capability = response.request().postDataJSON()?.capability;
    if (capability === 'dgos.aiTask.submit') submits.push({ input: response.request().postDataJSON()?.input, status: response.status(), body: await response.json().catch(() => ({})) });
    if (capability === 'dgos.model.list') modelLists.push({ status: response.status(), body: await response.json().catch(() => ({})) });
  });
  await page.goto('/providers');
  await page.getByLabel('Administrator ID').fill(process.env.REAL_ADMIN_ID);
  await page.getByLabel('Credential').fill(process.env.REAL_ADMIN_CREDENTIAL);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Providers', level: 1 })).toBeVisible();
  const configOption = page.getByLabel('Choose').locator('option').filter({ hasText: 'UI r5 dedicated provider' });
  await expect(configOption).toHaveCount(1);
  const configId = await configOption.getAttribute('value');
  expect(configId).toBeTruthy();
  const configList = await page.evaluate(async () => (await fetch('/api/v1/provider/configs')).json());
  const config = configList.items.find(item => item.id === configId);
  expect(config?.capabilityProtocolId).toMatch(/^ui-r5-/);
  expect(config?.capabilityProtocolVersion).toBe('1.0.0');
  await page.getByLabel('Choose').selectOption(configId);
  await page.getByLabel('Provider account').selectOption(config.providerAccountId);
  await expect(page.getByLabel('Provider account').locator('option:checked')).toContainText('UI r5 dedicated provider');
  await page.getByRole('button', { name: 'Connection test' }).click();
  await expect(page.locator('.result .dgos-status')).toHaveText('succeeded', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Enable' }).first().click();
  await expect(page.locator('.dgos-status').first()).toHaveText('ready');
  await page.getByRole('button', { name: 'Validate connection' }).click();
  await expect(page.locator('.dgos-status').last()).toHaveText('ready');
  await page.getByRole('button', { name: 'Refresh catalog' }).click();
  const model = page.locator('.record-list li').filter({ has: page.getByText('fixture-text-model', { exact: true }) });
  await expect(model).toBeVisible();
  await model.getByRole('checkbox', { name: 'Enable' }).check();
  await model.getByRole('checkbox', { name: 'Text capability' }).check();
  await model.getByRole('button', { name: 'Save changes' }).click();
  await page.getByRole('link', { name: 'App catalog' }).click();
  const app = page.locator('.record-list li').filter({ hasText: 'dgos.ai-workbench' });
  await app.getByRole('button', { name: 'Launch' }).click();
  const iframe = page.frameLocator('iframe[title="dgos.ai-workbench"]');
  await expect(iframe.locator('#model option')).not.toHaveCount(1);
  await expect.poll(() => modelLists.length).toBeGreaterThan(0);
  expect(modelLists.at(-1).status).toBe(200);
  const models = modelLists.at(-1).body.items.filter(item => item.intent === 'text.chat' && item.providerConfigId && item.modelId);
  const chosen = models.findIndex(item => item.providerConfigId === configId && item.modelId === 'fixture-text-model');
  expect(chosen).toBeGreaterThanOrEqual(0);
  await iframe.locator('#model').selectOption(String(chosen));
  await expect(iframe.locator('#parameters input[name="temperature"]')).toBeVisible();
  await expect(iframe.locator('#parameters input[name="maxOutputTokens"]')).toBeVisible();
  await iframe.locator('#parameters input[name="temperature"]').fill('0.7');
  await iframe.locator('#parameters input[name="maxOutputTokens"]').fill('48');
  await iframe.locator('#prompt').fill(`UI r5 parameter task ${runMarker}`);
  await iframe.locator('#submit').click();
  await expect.poll(() => submits.length).toBe(1);
  expect(submits[0].status).toBe(200);
  expect(submits[0].input.options).toMatchObject({ providerConfigId: configId, modelId: 'fixture-text-model', parameters: { temperature: 0.7, maxOutputTokens: 48 } });
  const taskId = submits[0].body.taskId;
  expect(taskId).toBeTruthy();
  await expect(iframe.locator('#result')).toContainText('hello world', { timeout: 20_000 });
  const task = await page.evaluate(async id => { const response = await fetch(`/api/v1/ai-tasks/${id}`); return response.json(); }, taskId);
  expect(task.status).toBe('succeeded');
  expect(task.artifactIds.length).toBeGreaterThan(0);
  const events = await page.evaluate(async id => (await fetch(`/api/v1/ai-tasks/${id}/events?cursor=0`)).text(), taskId);
  for (const line of events.split('\n')) if (line.startsWith('data: ')) { const item = JSON.parse(line.slice(6)); if (item.type === 'text.delta') deltas.push(item); }
  expect(deltas.length).toBeGreaterThan(0);
  await iframe.locator('#artifacts button').first().click();
  await expect(iframe.locator('#artifacts pre')).toContainText('hello world');
  await page.reload();
  await app.getByRole('button', { name: 'Launch' }).click();
  await expect(page.getByLabel('Task ID').last()).toHaveValue(taskId);
  await expect(page.locator('.task-output').first()).toContainText('hello world');
  const after = await (await fetch('http://127.0.0.1:15204/__fixture')).json();
  expect(after.requests.filter(item => item.path === '/v1/chat/completions').length - upstreamBefore).toBe(1);
  expect(submits).toHaveLength(1);
});
