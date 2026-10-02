import { test, expect } from '@playwright/test';

test.skip(!process.env.REAL_ADMIN_ID || !process.env.REAL_ADMIN_CREDENTIAL, 'Set integration administrator identity and credential');

async function signIn(page, route) {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message.slice(0, 160)));
  await page.goto(route);
  await page.getByLabel('Administrator ID').fill(process.env.REAL_ADMIN_ID);
  await page.getByLabel('Credential').fill(process.env.REAL_ADMIN_CREDENTIAL);
  const loginResponse = page.waitForResponse(response => response.url().endsWith('/api/v1/identity/admin/login') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  const response = await loginResponse;
  if (response.status() !== 200) {
    const body = await response.json().catch(() => ({}));
    throw new Error(`Admin login HTTP ${response.status()} errorKey=${body.errorKey || 'none'} requestId=${body.requestId || 'none'}`);
  }
  try { await expect(page.locator('.dgos-top h1')).toBeVisible(); }
  catch (error) {
    const state = await page.evaluate(async () => {
      const response = await fetch('/api/v1/identity/admin/session');
      const body = await response.json().catch(() => ({}));
      return { url: location.pathname, text: document.body.innerText.slice(0, 240), sessionStatus: response.status, errorKey: body.errorKey, requestId: body.requestId, alerts: [...document.querySelectorAll('[role="alert"]')].map(item => item.textContent?.slice(0, 160)) };
    });
    throw new Error(`Shell absent after HTTP 200 login: ${JSON.stringify({ ...state, pageErrors })}`, { cause: error });
  }
}

async function publicRead(page, path) {
  const result = await page.evaluate(async url => {
    const response = await fetch(url);
    return { status: response.status, body: await response.json() };
  }, path);
  expect(result.status, `${path}: errorKey=${result.body?.errorKey || 'none'} requestId=${result.body?.requestId || 'none'}`).toBe(200);
  return result.body;
}

async function receipt(response, expectedStatus) {
  const body = await response.json().catch(() => ({}));
  expect(response.status(), `${response.url()}: errorKey=${body.errorKey || 'none'} requestId=${body.requestId || response.headers()['x-request-id'] || 'none'}`).toBe(expectedStatus);
  return body;
}

async function setPermission(page, appId, capability, decision) {
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByLabel('Choose').selectOption('appPermissions');
  const form = page.locator('form').filter({ has: page.locator('input[name="capability"]') });
  await form.locator('input[name="appId"]').fill(appId);
  await form.locator('input[name="capability"]').fill(capability);
  await form.locator('select[name="decision"]').selectOption(decision);
  const patch = page.waitForResponse(response => response.url().endsWith('/api/v1/system/settings') && response.request().method() === 'PATCH');
  await form.getByRole('button', { name: 'Save changes' }).click();
  const response = await patch;
  const body = await receipt(response, 200);
  expect(response.request().postDataJSON()).toMatchObject({ domain: 'appPermissions', patch: { rules: [{ appId, capability, decision }] } });
  expect(body.appPermissions.some(rule => rule.appId === appId && rule.capability === capability && rule.decision === decision)).toBe(true);
}

test('real custom Skill creation, name edit and explicit disable', async ({ page }) => {
  test.setTimeout(45_000);
  const skillId = process.env.REAL_SKILL_ID || `ui-r6-${Date.now()}`;
  await signIn(page, '/skills');
  await expect(page.getByRole('heading', { name: 'Custom skill' })).toBeVisible();
  let created;
  if (process.env.REAL_SKILL_ID) {
    await setPermission(page, 'dgos.extensions', 'skill.read', 'allow');
    await setPermission(page, 'dgos.extensions', 'skill.manage', 'allow');
    await page.getByRole('link', { name: 'Skills' }).click();
    await page.locator('form.inline-form input').fill(skillId);
    await page.locator('form.inline-form').getByRole('button', { name: 'Edit definition' }).click();
    created = await publicRead(page, `/api/v1/skills/${skillId}/definition`);
  } else {
    await page.locator('details').filter({ has: page.getByText('Create', { exact: true }) }).first().getByText('Create', { exact: true }).click();
    const createForm = page.locator('details form').filter({ has: page.locator('input[name="skillId"]') });
    await createForm.locator('input[name="skillId"]').fill(skillId);
    await createForm.locator('input[name="name"]').fill('UI r6 management skill');
    await createForm.locator('textarea[name="description"]').fill('Controlled browser management case');
    await createForm.locator('textarea[name="systemPrompt"]').fill('Return a brief, factual answer.');
    await createForm.getByRole('button', { name: 'Create disabled skill' }).click();
    const createRequest = page.waitForResponse(response => response.url().endsWith('/api/v1/skills/custom') && response.request().method() === 'POST');
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
    created = await receipt(await createRequest, 201);
  }
  expect(created).toMatchObject({ skillId, sourceType: 'custom' });
  expect(['installed', 'disabled']).toContain(created.state);
  const definitionForm = page.locator('form').filter({ has: page.locator('textarea[name="systemPrompt"]') }).last();
  await definitionForm.locator('input[name="name"]').fill('UI r6 renamed skill');
  const updateRequest = page.waitForResponse(response => response.url().endsWith(`/api/v1/skills/${skillId}/definition`) && response.request().method() === 'PATCH');
  await definitionForm.getByRole('button', { name: 'Save changes' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
  const updated = await receipt(await updateRequest, 200);
  expect(updated.stateVersion).toBeGreaterThan(created.stateVersion);
  expect(updated.content.name).toBe('UI r6 renamed skill');
  const record = page.locator('.record-list li').filter({ hasText: skillId });
  await expect(record).toBeVisible();
  const stateRequest = page.waitForResponse(response => response.url().endsWith(`/api/v1/skills/${skillId}/state`) && response.request().method() === 'POST');
  await record.getByRole('button', { name: 'Enable' }).click();
  expect((await receipt(await stateRequest, 200)).state).toBe('enabled');
  await expect(record.getByRole('button', { name: 'Disable' })).toBeVisible();
  const disableRequest = page.waitForResponse(response => response.url().endsWith(`/api/v1/skills/${skillId}/state`) && response.request().method() === 'POST');
  await record.getByRole('button', { name: 'Disable' }).click();
  expect((await receipt(await disableRequest, 200)).state).toBe('disabled');
  const persisted = await publicRead(page, `/api/v1/skills/${skillId}/definition`);
  expect(persisted).toMatchObject({ state: 'disabled', content: { name: 'UI r6 renamed skill' } });
  await setPermission(page, 'dgos.extensions', 'skill.read', 'deny');
  await page.getByRole('link', { name: 'Skills' }).click();
  const denied = await page.evaluate(async id => { const response = await fetch(`/api/v1/skills/${id}/definition`); return { status: response.status, body: await response.json() }; }, skillId);
  expect(denied.status).toBe(403);
  expect(denied.body.errorKey).toBe('permission_denied');
  await setPermission(page, 'dgos.extensions', 'skill.read', 'allow');
});

test('real device list revokes only a second same-owner session by management ID', async ({ browser }) => {
  test.setTimeout(45_000);
  const first = await browser.newContext(), second = await browser.newContext();
  try {
    const page = await first.newPage(), other = await second.newPage();
    await signIn(page, '/settings');
    await signIn(other, '/settings');
    const secondDevices = await publicRead(other, '/api/v1/identity/admin/sessions');
    const target = secondDevices.items.find(item => item.current);
    expect(target?.sessionManagementId).toMatch(/^sm_[A-Za-z0-9_-]{32,128}$/);
    const firstDevices = await publicRead(page, '/api/v1/identity/admin/sessions');
    const index = firstDevices.items.findIndex(item => item.sessionManagementId === target.sessionManagementId);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(firstDevices.items[index].current).toBe(false);
    const devicesPanel = page.locator('.dgos-panel').filter({ has: page.getByRole('heading', { name: 'Device sessions' }) });
    await devicesPanel.getByRole('button', { name: 'Refresh' }).click();
    const rows = devicesPanel.locator('.record-list li');
    await expect(rows).toHaveCount(firstDevices.items.length);
    const revokeRequest = page.waitForResponse(response => response.url().endsWith(`/api/v1/identity/admin/sessions/${target.sessionManagementId}`) && response.request().method() === 'DELETE');
    await rows.nth(index).getByRole('button', { name: 'Revoke' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
    const response = await revokeRequest;
    const body = await receipt(response, 200);
    expect(response.request().postDataJSON().requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(body)).not.toContain('sessionId');
    const after = await publicRead(page, '/api/v1/identity/admin/sessions');
    expect(after.items.find(item => item.sessionManagementId === target.sessionManagementId)?.state).toBe('revoked');
    const invalid = await other.evaluate(async () => (await fetch('/api/v1/identity/admin/session')).status);
    expect(invalid).toBe(401);
    expect((await publicRead(page, '/api/v1/identity/admin/session')).state).toBe('active');
    const logout = page.waitForResponse(response => response.url().endsWith('/api/v1/identity/admin/session') && response.request().method() === 'DELETE');
    await page.getByRole('button', { name: 'Sign out' }).click();
    expect((await logout).status()).toBe(204);
    await expect(page.getByLabel('Administrator ID')).toBeVisible();
    expect(await page.evaluate(async () => (await fetch('/api/v1/identity/admin/session')).status)).toBe(401);
  } finally { await first.close(); await second.close(); }
});

test('real governance policy uses CAS and an audited browser update', async ({ page }) => {
  await signIn(page, '/governance');
  const before = await publicRead(page, '/api/v1/admin/governance/policy');
  await page.getByRole('button', { name: 'Edit' }).click();
  const form = page.locator('form').filter({ has: page.locator('input[name="audit"]') });
  await form.locator('input[name="audit"]').fill(String(before.auditRetentionDays));
  await form.locator('input[name="cache"]').fill(String(before.cacheRetentionDays));
  await form.locator('input[name="sessions"]').fill(String(before.revokedSessionRetentionDays));
  await form.locator('input[name="reason"]').fill('UI r6 live governance CAS verification');
  const updateRequest = page.waitForResponse(response => response.url().endsWith('/api/v1/admin/governance/policy') && response.request().method() === 'PUT');
  await form.getByRole('button', { name: 'Save changes' }).click();
  const response = await updateRequest;
  const input = response.request().postDataJSON();
  expect(input).toMatchObject({ baseVersion: before.version, reason: 'UI r6 live governance CAS verification' });
  const updated = await receipt(response, 200);
  expect(updated.version).not.toBe(before.version);
  const audit = await publicRead(page, '/api/v1/audit/events?action=governance.policy.update&limit=100');
  const auditRequestId = response.headers()['x-request-id'];
  expect(auditRequestId).toBeTruthy();
  expect(audit.items.some(item => item.requestId === auditRequestId)).toBe(true);
  await page.getByRole('button', { name: 'Preview' }).click();
  await expect(page.getByText('Retention preview')).toBeVisible();
});

test('real quota form creates one subject policy through the public API', async ({ page }) => {
  await signIn(page, '/usage');
  const metric = `ui.r6.${Date.now()}`;
  const before = await publicRead(page, '/api/v1/quota/policies');
  await page.getByRole('button', { name: 'Create' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[name="metric"]').fill(metric);
  await dialog.locator('input[name="limit"]').fill('25');
  await dialog.locator('select[name="window"]').selectOption('day');
  const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/v1/quota/policies') && response.request().method() === 'PUT');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  const response = await responsePromise;
  const body = await receipt(response, 200);
  expect(body).toMatchObject({ metric, limit: 25, window: 'day' });
  const after = await publicRead(page, '/api/v1/quota/policies');
  expect(after.items.length).toBe(before.items.length + 1);
  expect(after.items.some(item => item.metric === metric && item.policyId === body.policyId)).toBe(true);
});

test('real assistant resolves a registered navigation candidate before explicit execution', async ({ page }) => {
  const calls = [];
  page.on('request', request => {
    if (/\/api\/v1\/(actions\/resolve|actions\/[^/]+\/(plan|execute))$/.test(request.url())) calls.push({ url: request.url(), method: request.method() });
  });
  await signIn(page, '/assistant');
  await page.getByLabel('What do you want to do?').fill('open settings');
  const resolveResponse = page.waitForResponse(response => response.url().endsWith('/api/v1/actions/resolve') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Find actions' }).click();
  const resolved = await receipt(await resolveResponse, 200);
  expect(resolved.candidates.some(item => item.actionId === 'system.navigate.system.settings')).toBe(true);
  expect(calls.filter(item => item.url.endsWith('/execute'))).toHaveLength(0);
  const candidate = page.locator('.result .record-list li').filter({ hasText: 'system.navigate.system.settings' });
  await candidate.getByRole('button', { name: 'Choose' }).click();
  const planResponse = page.waitForResponse(response => response.url().endsWith('/actions/system.navigate.system.settings/plan') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Create plan' }).click();
  const plan = await receipt(await planResponse, 200);
  expect(plan.planId).toBeTruthy();
  expect(calls.filter(item => item.url.endsWith('/execute'))).toHaveLength(0);
  if (plan.permission?.decision === 'ask') {
    const permissionResponse = page.waitForResponse(response => response.url().endsWith('/api/v1/permissions/request') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Request permission' }).click();
    const requested = await permissionResponse;
    expect(requested.status()).toBe(202);
    const requestBody = await requested.json();
    expect(requestBody.decision).toBe('ask');
    expect(calls.filter(item => item.url.endsWith('/execute'))).toHaveLength(0);
    if (requestBody.confirmationRequired) {
      await page.getByRole('button', { name: 'Allow this capability' }).click();
    } else {
      await setPermission(page, 'dgos.system', 'system.navigate', 'allow');
      await page.getByRole('link', { name: 'System assistant' }).click();
      await page.getByLabel('Action').selectOption('system.navigate.system.settings');
    }
    const replanResponse = page.waitForResponse(response => response.url().endsWith('/actions/system.navigate.system.settings/plan') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Create plan' }).click();
    expect((await receipt(await replanResponse, 200)).permission?.decision).toBe('allow');
  } else expect(plan.permission?.decision).toBe('allow');
  const executeResponse = page.waitForResponse(response => response.url().endsWith('/actions/system.navigate.system.settings/execute') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Confirm and execute' }).click();
  const run = await receipt(await executeResponse, 202);
  expect(run.runId).toBeTruthy();
  await expect(page).toHaveURL(/\/settings$/);
  expect(calls.filter(item => item.url.endsWith('/execute'))).toHaveLength(1);
});

test('real assistant denied navigation exposes no candidate and creates no run', async ({ page }) => {
  await signIn(page, '/settings');
  await setPermission(page, 'dgos.system', 'system.navigate', 'deny');
  try {
    const calls = [];
    page.on('request', request => {
      if (/\/api\/v1\/actions\/[^/]+\/(plan|execute)$/.test(request.url())) calls.push(request.url());
    });
    await page.getByRole('link', { name: 'System assistant' }).click();
    await page.getByLabel('What do you want to do?').fill('open settings');
    const response = page.waitForResponse(value => value.url().endsWith('/api/v1/actions/resolve') && value.request().method() === 'POST');
    await page.getByRole('button', { name: 'Find actions' }).click();
    const resolved = await receipt(await response, 200);
    expect(resolved.candidates.some(value => value.actionId === 'system.navigate.system.settings')).toBe(false);
    await expect(page.getByText('No registered action matches.')).toBeVisible();
    expect(calls).toHaveLength(0);
  } finally {
    await setPermission(page, 'dgos.system', 'system.navigate', 'allow');
  }
});

test('real high-risk settings action needs explicit execution and leaves a durable audit', async ({ page }) => {
  test.setTimeout(45_000);
  await signIn(page, '/settings');
  await setPermission(page, 'dgos.system', 'system.settings.write', 'allow');
  const before = await publicRead(page, '/api/v1/system/settings');
  await page.getByRole('link', { name: 'System assistant' }).click();
  await page.getByLabel('Action').selectOption('system.settings.privacy.patch');
  await page.getByRole('textbox', { name: 'baseVersion' }).fill(before.settingsVersion);
  await page.getByRole('textbox', { name: 'value' }).fill(JSON.stringify({ telemetry: Boolean(before.privacy?.telemetry) }));
  const planResponse = page.waitForResponse(value => value.url().endsWith('/actions/system.settings.privacy.patch/plan') && value.request().method() === 'POST');
  await page.getByRole('button', { name: 'Create plan' }).click();
  const plan = await receipt(await planResponse, 200);
  expect(plan.riskLevel).toBe('high');
  expect(plan.confirmationRequired).toBe(true);
  expect(plan.permission.decision).toBe('allow');
  await expect(page.getByRole('button', { name: 'Confirm and execute' })).toBeVisible();
  const executeResponse = page.waitForResponse(value => value.url().endsWith('/actions/system.settings.privacy.patch/execute') && value.request().method() === 'POST');
  await page.getByRole('button', { name: 'Confirm and execute' }).click();
  const response = await executeResponse;
  expect(response.request().postDataJSON()).toMatchObject({ planId: plan.planId, confirmed: true, input: { baseVersion: before.settingsVersion, value: { telemetry: Boolean(before.privacy?.telemetry) } } });
  const run = await receipt(response, 202);
  await expect.poll(async () => (await publicRead(page, `/api/v1/action-runs/${run.runId}`)).state, { timeout: 15000 }).toBe('succeeded');
  const after = await publicRead(page, '/api/v1/system/settings');
  expect(after.privacy?.telemetry).toBe(before.privacy?.telemetry);
  expect(after.settingsVersion).not.toBe(before.settingsVersion);
  const audit = await publicRead(page, '/api/v1/audit/events?action=action.run.terminal&limit=100');
  expect(audit.items.some(item => item.target?.id === run.runId || item.targetId === run.runId)).toBe(true);
});

test('real queued assistant run is cancelled by the browser and stays durable', async ({ page }) => {
  test.skip(process.env.REAL_ACTION_CANCEL_QUEUED !== '1', 'Requires a controlled 15200 worker pause');
  await signIn(page, '/assistant');
  await page.getByLabel('Action').selectOption('system.navigate.system.settings');
  const planResponse = page.waitForResponse(value => value.url().endsWith('/actions/system.navigate.system.settings/plan') && value.request().method() === 'POST');
  await page.getByRole('button', { name: 'Create plan' }).click();
  expect((await receipt(await planResponse, 200)).permission.decision).toBe('allow');
  const executeResponse = page.waitForResponse(value => value.url().endsWith('/actions/system.navigate.system.settings/execute') && value.request().method() === 'POST');
  await page.getByRole('button', { name: 'Confirm and execute' }).click();
  const run = await receipt(await executeResponse, 202);
  expect((await publicRead(page, `/api/v1/action-runs/${run.runId}`)).state).toBe('queued');
  const cancelResponse = page.waitForResponse(value => value.url().endsWith(`/api/v1/action-runs/${run.runId}`) && value.request().method() === 'DELETE');
  await page.getByRole('button', { name: 'Cancel' }).click();
  expect((await receipt(await cancelResponse, 200)).state).toBe('cancelled');
  await page.reload();
  await expect(page.getByText(`Run ID: ${run.runId}`)).toBeVisible();
  expect((await publicRead(page, `/api/v1/action-runs/${run.runId}`)).state).toBe('cancelled');
  await expect(page).toHaveURL(/\/assistant$/);
});
