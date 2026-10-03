import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const enabled = process.env.REAL_MANAGEMENT_FIXTURE === '1';
test.skip(!enabled, 'Set REAL_MANAGEMENT_FIXTURE=1 for the isolated live management fixture');
const state = enabled ? JSON.parse(readFileSync(new URL('../../../data/v1-ui-management-fixture/state.json', import.meta.url))) : null;
const credentials = enabled ? JSON.parse(readFileSync(state.privateCredentialsFile)) : null;

async function signIn(page, route) {
  await page.goto(route);
  await page.getByLabel('Administrator ID').fill(state.principalId);
  await page.getByLabel('Credential').fill(credentials.adminCredential);
  const response = page.waitForResponse(value => value.url().endsWith('/api/v1/identity/admin/login') && value.request().method() === 'POST');
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await accepted(await response, 200);
  await expect(page.getByRole('dialog', { name: route.replace('/', '').replace(/^./, value => value.toUpperCase()) })).toBeVisible();
}

async function accepted(response, status) {
  const body = await response.json().catch(() => ({}));
  expect(response.status(), `${response.request().method()} ${new URL(response.url()).pathname}: errorKey=${body.errorKey || 'none'} requestId=${body.requestId || response.headers()['x-request-id'] || 'none'}`).toBe(status);
  return body;
}

async function read(page, path) {
  const result = await page.evaluate(async url => {
    const response = await fetch(url);
    return { status: response.status, body: await response.json() };
  }, path);
  expect(result.status, `${path}: errorKey=${result.body?.errorKey || 'none'} requestId=${result.body?.requestId || 'none'}`).toBe(200);
  return result.body;
}

function passed(name) {
  console.log(JSON.stringify({ case_passed: name }));
}

async function permissionDecision(page, decision) {
  const settings = await read(page, '/api/v1/system/settings');
  const rule = { appId: 'dgos.system', subjectType: 'user', subjectId: state.principalId, capability: 'system.navigate', scope: { value: '*' }, decision };
  const result = await page.evaluate(async ({ baseVersion, rule }) => {
    const response = await fetch('/api/v1/system/settings', {
      method: 'PATCH', headers: { 'content-type': 'application/json', 'x-dgos-csrf': 'web' },
      body: JSON.stringify({ requestId: crypto.randomUUID(), baseVersion, domain: 'appPermissions', patch: { rules: [rule] } }),
    });
    return { status: response.status, body: await response.json() };
  }, { baseVersion: settings.settingsVersion, rule });
  expect(result.status, `System appPermissions PATCH: ${result.body.errorKey || 'none'} requestId=${result.body.requestId || 'none'}`).toBe(200);
  expect(result.body.appPermissions).toEqual(expect.arrayContaining([expect.objectContaining(rule)]));
  return result.body;
}

async function extensionPermissionDecision(page, decision) {
  const settings = await read(page, '/api/v1/system/settings');
  const rule = { appId: 'dgos.extensions', subjectType: 'user', subjectId: state.principalId, capability: 'skill.read', scope: { value: '*' }, decision };
  const result = await page.evaluate(async ({ baseVersion, rule }) => {
    const response = await fetch('/api/v1/system/settings', {
      method: 'PATCH', headers: { 'content-type': 'application/json', 'x-dgos-csrf': 'web' },
      body: JSON.stringify({ requestId: crypto.randomUUID(), baseVersion, domain: 'appPermissions', patch: { rules: [rule] } }),
    });
    return { status: response.status, body: await response.json() };
  }, { baseVersion: settings.settingsVersion, rule });
  expect(result.status, `skill.read permission patch: ${result.body.errorKey || 'none'}`).toBe(200);
  return result.body;
}

test('real Skill definition enforces independent skill.read ask deny allow decisions', async ({ page }) => {
  test.setTimeout(60_000);
  await signIn(page, '/skills');
  const skillId = `ui_read_browser_${crypto.randomUUID().replaceAll('-', '')}`;
  const createForm = page.locator('details form').filter({ has: page.locator('input[name="skillId"]') });
  await page.locator('details').filter({ has: page.getByText('Create', { exact: true }) }).first().getByText('Create', { exact: true }).click();
  await createForm.locator('input[name="skillId"]').fill(skillId);
  await createForm.locator('input[name="name"]').fill('Read permission fixture');
  await createForm.locator('textarea[name="description"]').fill('Independent read permission fixture');
  await createForm.locator('textarea[name="systemPrompt"]').fill('PRIVATE_SKILL_READ_PROMPT');
  await createForm.getByRole('button', { name: 'Create disabled skill' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByText(skillId)).toBeVisible();

  await extensionPermissionDecision(page, 'ask');
  const readDefinition = () => page.evaluate(async skill => { const response = await fetch(`/api/v1/skills/${encodeURIComponent(skill)}/definition`); return { status: response.status, body: await response.json() }; }, skillId);
  let readResult = await readDefinition();
  expect(readResult).toMatchObject({ status: 409, body: { errorKey: 'confirmation_required' } });
  expect(JSON.stringify(readResult)).not.toContain('PRIVATE_SKILL_READ_PROMPT');
  const permissionRequest = await page.evaluate(async () => { const response = await fetch('/api/v1/permissions/request', { method: 'POST', headers: { 'content-type': 'application/json', 'x-dgos-csrf': 'web' }, body: JSON.stringify({ requestId: crypto.randomUUID(), appId: 'dgos.extensions', capability: 'skill.read', scope: '*' }) }); return { status: response.status, body: await response.json() }; });
  expect(permissionRequest.status).toBe(202);
  expect(permissionRequest.body.confirmationRequired).toBe(true);
  passed('ui.skill.read.ask');

  await extensionPermissionDecision(page, 'deny');
  readResult = await readDefinition();
  expect(readResult).toMatchObject({ status: 403, body: { errorKey: 'permission_denied' } });
  expect(JSON.stringify(readResult)).not.toContain('PRIVATE_SKILL_READ_PROMPT');
  passed('ui.skill.read.deny');

  await extensionPermissionDecision(page, 'allow');
  readResult = await readDefinition();
  expect(readResult.status).toBe(200);
  expect(readResult.body.content.systemPrompt).toBe('PRIVATE_SKILL_READ_PROMPT');
  passed('ui.skill.read.allow');
});

test('real Skill translation reaches Task, Artifact and confirmed apply', async ({ page }) => {
  test.setTimeout(90_000);
  await signIn(page, '/skills');
  const skillId = `ui_translation_browser_${crypto.randomUUID().replaceAll('-', '')}`;
  await page.locator('details').filter({ has: page.getByText('Create', { exact: true }) }).first().getByText('Create', { exact: true }).click();
  const createForm = page.locator('details form').filter({ has: page.locator('input[name="skillId"]') });
  await createForm.locator('input[name="skillId"]').fill(skillId);
  await createForm.locator('input[name="name"]').fill('Browser greeting');
  await createForm.locator('textarea[name="description"]').fill('Browser translation fixture');
  await createForm.locator('textarea[name="systemPrompt"]').fill('Answer briefly.');
  await createForm.getByRole('button', { name: 'Create disabled skill' }).click();
  const createdResponse = page.waitForResponse(value => value.url().endsWith('/api/v1/skills/custom') && value.request().method() === 'POST');
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
  const created = await accepted(await createdResponse, 201);
  expect(created.skillId).toBe(skillId);
  const form = page.locator('form').filter({ has: page.locator('select[name="targetLocale"]') });
  await form.locator('select[name="targetLocale"]').selectOption('en-US');
  await form.locator('input[name="name"]').check();
  await form.locator('input[name="providerConfigId"]').fill(state.providerConfigId);
  await form.locator('input[name="modelId"]').fill(state.modelId);
  await form.getByRole('button', { name: 'Translate skill' }).click();
  const translateResponse = page.waitForResponse(value => value.url().endsWith(`/api/v1/skills/${skillId}/translations`) && value.request().method() === 'POST');
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
  const taskReceipt = await accepted(await translateResponse, 202);
  expect(taskReceipt.taskId).toBeTruthy();
  let task;
  for (let attempt = 0; attempt < 40; attempt++) {
    const response = page.waitForResponse(value => value.url().endsWith(`/api/v1/ai-tasks/${taskReceipt.taskId}`) && value.request().method() === 'GET');
    await page.getByRole('button', { name: 'Read task' }).click();
    task = await accepted(await response, 200);
    if (['succeeded', 'failed', 'cancelled'].includes(task.status)) break;
    await page.waitForTimeout(500);
  }
  expect(task?.status).toBe('succeeded');
  expect(task.artifactIds).toHaveLength(1);
  const artifactResponse = page.waitForResponse(value => value.url().endsWith(`/api/v1/artifacts/${task.artifactIds[0]}`));
  await page.getByRole('button', { name: 'Read artifact' }).click();
  const artifact = await accepted(await artifactResponse, 200);
  expect(JSON.parse(artifact.content)).toEqual({ name: 'Browser greeting translated' });
  const applyResponse = page.waitForResponse(value => value.url().endsWith(`/api/v1/skills/${skillId}/translations/apply`) && value.request().method() === 'POST');
  await page.getByRole('button', { name: 'Apply translation' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
  const applied = await accepted(await applyResponse, 200);
  expect(applied.localizedDisplay['en-US'].name).toBe('Browser greeting translated');
  expect((await read(page, `/api/v1/skills/${skillId}/definition`)).localizedDisplay['en-US'].name).toBe('Browser greeting translated');
  passed('ui.skill.translation_apply');
  const stale = await page.evaluate(async ({ skillId, baseVersion, taskId, artifactId }) => {
    const response = await fetch(`/api/v1/skills/${skillId}/translations/apply`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-dgos-csrf': 'web' },
      body: JSON.stringify({ requestId: crypto.randomUUID(), baseVersion, taskId, artifactId, confirmed: true }),
    });
    const body = await response.json();
    return { status: response.status, errorKey: body.errorKey, requestId: body.requestId };
  }, { skillId, baseVersion: created.stateVersion, taskId: taskReceipt.taskId, artifactId: artifact.artifactId });
  expect(stale).toMatchObject({ status: 409, errorKey: 'version_conflict' });
  expect(stale.requestId).toBeTruthy();
  expect((await read(page, `/api/v1/skills/${skillId}/definition`)).localizedDisplay['en-US'].name).toBe('Browser greeting translated');
  passed('ui.skill.translation_stale_rejected');
});

test('real MCP first credential install requires an absent target', async ({ page }) => {
  test.setTimeout(90_000);
  await signIn(page, '/mcp');
  expect((await read(page, '/api/v1/mcp')).items.find(value => value.id === state.mcpId), 'first-install fixture must not contain the target MCP').toBeUndefined();
  const template = page.locator('.record-list li').filter({ hasText: state.mcpTemplateId }).first();
  await expect(template).toContainText('needs-credentials');
  const previewResponse = page.waitForResponse(value => value.url().endsWith('/api/v1/extensions/previews') && value.request().method() === 'POST');
  await template.getByRole('button', { name: 'Choose' }).click();
  const preview = await accepted(await previewResponse, 200);
  expect(preview.trustState).toBe('verified');
  expect(preview.summary.id).toBe(state.mcpId);
  const installForm = page.locator('form').filter({ has: page.locator('input[name="secret:apiKey"]') });
  await installForm.locator('input[name="secret:apiKey"]').fill(credentials.mcpCredential);
  await installForm.getByRole('button', { name: 'Install' }).click();
  const installResponse = page.waitForResponse(value => value.url().endsWith('/api/v1/mcp') && value.request().method() === 'POST');
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
  const installed = await accepted(await installResponse, 202);
  expect(installed).toMatchObject({ id: state.mcpId, credentialStatus: 'configured' });
  expect((await read(page, '/api/v1/mcp')).items.find(value => value.id === state.mcpId)).toBeTruthy();
  passed('ui.mcp.first_install');
});

test('real installed MCP connects, discovers tools and invokes a confirmed Run', async ({ page }) => {
  test.setTimeout(90_000);
  await signIn(page, '/mcp');
  const installed = (await read(page, '/api/v1/mcp')).items.find(value => value.id === state.mcpId);
  expect(installed, 'install the target MCP before running the installed subset').toBeTruthy();
  expect(installed.credentialStatus).toBe('configured');
  const row = page.locator('.record-list li').filter({ hasText: state.mcpId }).last();
  await expect(row).toBeVisible();
  if (installed.state !== 'enabled') {
    const stateResponse = page.waitForResponse(value => value.url().endsWith(`/api/v1/mcp/${state.mcpId}/state`) && value.request().method() === 'POST');
    await row.getByRole('button', { name: 'Enable' }).click();
    expect((await accepted(await stateResponse, 200)).state).toBe('enabled');
  }
  if (installed.connectionState !== 'connected') {
    const connectResponse = page.waitForResponse(value => value.url().endsWith(`/api/v1/mcp/${state.mcpId}/connect`) && value.request().method() === 'POST');
    await row.getByRole('button', { name: 'Connect' }).click();
    await accepted(await connectResponse, 202);
  }
  for (let attempt = 0; attempt < 30; attempt++) {
    const item = (await read(page, '/api/v1/mcp')).items.find(value => value.id === state.mcpId);
    if (item.connectionState === 'connected') break;
    await page.waitForTimeout(500);
  }
  const connected = (await read(page, '/api/v1/mcp')).items.find(value => value.id === state.mcpId);
  expect(connected.connectionState).toBe('connected');
  await page.getByRole('button', { name: 'Refresh' }).last().click();
  const toolsResponse = page.waitForResponse(value => value.url().endsWith(`/api/v1/mcp/${state.mcpId}/tools`) && value.request().method() === 'GET');
  await row.getByRole('button', { name: 'Tools' }).click();
  expect((await accepted(await toolsResponse, 200)).items.some(value => value.operationId === 'credential')).toBe(true);
  const discoverResponse = page.waitForResponse(value => value.url().endsWith(`/api/v1/mcp/${state.mcpId}/tools`) && value.request().method() === 'POST');
  await page.locator('h2').filter({ hasText: 'Tools' }).locator('..').getByRole('button', { name: 'Discover tools' }).click();
  await accepted(await discoverResponse, 200);
  await page.locator('.record-list li').filter({ hasText: 'credential' }).last().getByRole('button', { name: 'Choose' }).click();
  await page.getByLabel('Calling app ID').fill(state.appId);
  const ticketResponse = page.waitForResponse(value => value.url().endsWith('/api/v1/extensions/confirmations') && value.request().method() === 'POST');
  await page.getByRole('button', { name: 'Confirm and issue ticket' }).click();
  const ticket = await accepted(await ticketResponse, 201);
  expect(ticket.confirmationId).toBeTruthy();
  const invokeResponse = page.waitForResponse(value => value.url().endsWith('/api/v1/extensions/runs') && value.request().method() === 'POST');
  await page.getByRole('button', { name: 'Invoke tool' }).click();
  const run = await accepted(await invokeResponse, 202);
  expect(run.runId).toBeTruthy();
  for (let attempt = 0; attempt < 30; attempt++) {
    const current = await read(page, `/api/v1/extensions/runs/${run.runId}`);
    if (['succeeded', 'failed', 'blocked'].includes(current.state)) {
      expect(current.state).toBe('succeeded');
      break;
    }
    await page.waitForTimeout(500);
  }
  const finished = await read(page, `/api/v1/extensions/runs/${run.runId}`);
  expect(finished.state).toBe('succeeded');
  expect(JSON.stringify(finished)).not.toContain(credentials.mcpCredential);
  expect(JSON.stringify(await read(page, '/api/v1/mcp'))).not.toContain(credentials.mcpCredential);
  passed('ui.mcp.connect_invoke');
});

test('real assistant request needs System approval, then its run opens Settings', async ({ page }) => {
  test.setTimeout(60_000);
  await signIn(page, '/assistant');
  await permissionDecision(page, 'ask');
  await page.getByLabel('What do you want to do?').fill('open settings');
  const resolveResponse = page.waitForResponse(value => value.url().endsWith('/api/v1/actions/resolve') && value.request().method() === 'POST');
  await page.getByRole('button', { name: 'Find actions' }).click();
  const candidates = await accepted(await resolveResponse, 200);
  expect(candidates.candidates.some(value => value.actionId === 'system.navigate.system.settings')).toBe(true);
  await page.locator('.result .record-list li').filter({ hasText: 'system.navigate.system.settings' }).getByRole('button', { name: 'Choose' }).click();
  const planResponse = page.waitForResponse(value => value.url().endsWith('/actions/system.navigate.system.settings/plan') && value.request().method() === 'POST');
  await page.getByRole('button', { name: 'Create plan' }).click();
  let plan = await accepted(await planResponse, 200);
  expect(plan.planId).toBeTruthy();
  expect(plan.permission.decision).toBe('ask');
  try {
    const requestResponse = page.waitForResponse(value => value.url().endsWith('/api/v1/permissions/request') && value.request().method() === 'POST');
    await page.getByRole('button', { name: 'Request permission' }).click();
    const request = await accepted(await requestResponse, 202);
    expect(request.decision).toBe('ask');
    await expect(page.getByRole('button', { name: 'Confirm and execute' })).toHaveCount(0);
    expect(request.confirmationRequired).toBe(true);
    passed('ui.assistant.ask_request');
    const patchResponse = page.waitForResponse(value => value.url().endsWith('/api/v1/system/settings') && value.request().method() === 'PATCH');
    await page.getByRole('button', { name: 'Allow this capability' }).click();
    const patch = await patchResponse;
    const body = patch.request().postDataJSON();
    expect(body).toMatchObject({ domain: 'appPermissions', patch: { rules: [{ appId: 'dgos.system', capability: 'system.navigate', subjectId: state.principalId, decision: 'allow', scope: { value: '*' } }] } });
    const updated = await accepted(patch, 200);
    expect(updated.appPermissions.some(value => value.capability === 'system.navigate' && value.decision === 'allow')).toBe(true);
    const replanResponse = page.waitForResponse(value => value.url().endsWith('/actions/system.navigate.system.settings/plan') && value.request().method() === 'POST');
    await page.getByRole('button', { name: 'Create plan' }).click();
    plan = await accepted(await replanResponse, 200);
    expect(plan.permission.decision).toBe('allow');
  const executeResponse = page.waitForResponse(value => value.url().endsWith('/actions/system.navigate.system.settings/execute') && value.request().method() === 'POST');
  await page.getByRole('button', { name: 'Confirm and execute' }).click();
  const run = await accepted(await executeResponse, 202);
  expect(run.runId).toBeTruthy();
  await expect.poll(async () => (await read(page, `/api/v1/action-runs/${run.runId}`)).state, { timeout: 15_000 }).toBe('succeeded');
  await expect(page).toHaveURL(/\/settings$/);
  passed('ui.assistant.allow_replan_navigation');
  } finally {
    await permissionDecision(page, 'ask');
  }
});
