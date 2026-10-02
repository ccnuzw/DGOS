import { test, expect } from '@playwright/test';

const respond = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/identity/admin/session', route => respond(route, { sessionId: 'session-1', principalId: 'owner' }));
});

test('task route restores an existing task without submitting or repeating snapshot text', async ({ page }) => {
  let taskStatus = 'running';
  let taskReads = 0;
  let submits = 0;
  await page.route('**/api/v1/ai-tasks', route => { submits++; return respond(route, { errorKey: 'unexpected_submit' }, 500); });
  await page.route('**/api/v1/ai-tasks/task-1/events**', route => { taskStatus = 'succeeded'; return route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'id: 1\nevent: text.delta\ndata: {"sequence":1,"type":"text.delta","delta":"hello world"}\n\n' }); });
  await page.route('**/api/v1/ai-tasks/task-1', route => {taskReads+=1;return respond(route, { taskId: 'task-1', status: taskStatus, text: 'hello world', artifactIds: ['artifact-1'] });});
  await page.goto('/ai-tasks');
  await page.getByLabel('Task ID').fill('task-1');
  await page.getByRole('button', { name: 'Re-query / resume' }).first().click();
  await expect(page.locator('.task-output')).toHaveText('hello world');
  const beforeResume=taskReads;
  await page.getByRole('button', { name: 'Re-query / resume' }).last().click();
  await expect.poll(()=>taskReads).toBeGreaterThan(beforeResume);
  await page.reload();
  await expect(page.getByLabel('Task ID').first()).toHaveValue('task-1');
  await expect(page.getByText('Task ID: task-1')).toBeVisible();
  await expect(page.locator('.task-output')).toHaveText('hello world');
  expect(submits).toBe(0);
});

test('skill translation freezes the reviewed request and applies only the task artifact reference', async ({ page }) => {
  let translation, applied, reads = 0;
  const definition = { skillId: 'local.text', stateVersion: 3, state: 'disabled', sourceType: 'custom', content: { name: 'Local text', description: 'Local description', systemPrompt: 'private prompt fixture' } };
  await page.route('**/api/v1/skills', route => respond(route, { items: [] }));
  await page.route('**/api/v1/skills/local.text/definition', route => respond(route, definition));
  await page.route('**/api/v1/skills/local.text/translations', route => { translation = route.request().postDataJSON(); return respond(route, { taskId: 'translation-task', status: 'queued' }, 202); });
  await page.route('**/api/v1/ai-tasks/translation-task', route => { reads++; return respond(route, { taskId: 'translation-task', status: 'succeeded', artifactIds: ['translation-artifact'] }); });
  await page.route('**/api/v1/artifacts/translation-artifact', route => respond(route, { artifactId: 'translation-artifact', content: '{"name":"Translated name"}' }));
  await page.route('**/api/v1/skills/local.text/translations/apply', route => { applied = route.request().postDataJSON(); return respond(route, { ...definition, stateVersion: 4 }); });
  await page.goto('/skills');
  await page.getByLabel('Skill ID').last().fill('local.text');
  await page.getByRole('button', { name: 'Edit definition' }).click();
  await page.getByRole('checkbox', { name: 'Name' }).check();
  await page.getByLabel('Provider configuration ID').fill('provider-1');
  await page.getByLabel('Model ID').fill('model-1');
  await page.getByRole('button', { name: 'Translate skill' }).click();
  const review = page.getByRole('dialog', { name: 'Review fields and model cost' });
  await expect(review).toBeVisible();
  await expect(review).not.toContainText('private prompt fixture');
  expect(translation).toBeUndefined();
  await review.getByRole('button', { name: 'Confirm' }).click();
  await expect.poll(() => translation).toBeTruthy();
  expect(translation).toMatchObject({ baseVersion: 3, targetLocale: 'zh-CN', fields: ['name'], options: { providerConfigId: 'provider-1', modelId: 'model-1' }, confirmed: true });
  await page.getByRole('button', { name: 'Read task' }).click();
  await expect.poll(() => reads).toBe(1);
  await page.getByRole('button', { name: 'Read artifact' }).click();
  await page.getByRole('button', { name: 'Apply translation' }).click();
  await page.getByRole('dialog', { name: 'Apply translation' }).getByRole('button', { name: 'Confirm' }).click();
  await expect.poll(() => applied).toBeTruthy();
  expect(applied).toMatchObject({ baseVersion: 3, taskId: 'translation-task', artifactId: 'translation-artifact', confirmed: true });
  expect(applied).not.toHaveProperty('content');
});

test('MCP configuration shows only selected template credentials and never displays their values', async ({ page }) => {
  let update;
  const selected = { id: 'mcp-example', version: '1.0.0', stateVersion: 2, state: 'disabled', connectionState: 'stopped', credentialStatus: 'missing' };
  const templates = [{ templateId: 'template-a', version: '1.0.0', name: 'Template A', setupState: 'needs-credentials', config: { transport: 'stdio', runnerProfileId: 'runner-a' }, credentialFields: [{ name: 'token', label: 'Access token', required: true }] }, { templateId: 'template-b', version: '1.0.0', name: 'Template B', setupState: 'needs-credentials', config: { transport: 'stdio', runnerProfileId: 'runner-b' }, credentialFields: [{ name: 'apiKey', label: 'API key', required: true }] }];
  await page.route('**/api/v1/mcp', route => respond(route, { items: [selected] }));
  await page.route('**/api/v1/mcp/templates', route => respond(route, { items: templates }));
  await page.route('**/api/v1/mcp/mcp-example/config', route => { update = route.request().postDataJSON(); return respond(route, selected); });
  await page.goto('/mcp');
  await page.getByRole('button', { name: 'Configure MCP service' }).click();
  await page.getByRole('button', { name: 'Refresh' }).last().click();
  await expect(page.getByLabel('Access token')).toBeVisible();
  await expect(page.getByLabel('API key')).toHaveCount(0);
  await page.getByLabel('MCP templates').selectOption('template-b');
  await expect(page.getByLabel('Access token')).toHaveCount(0);
  await page.getByLabel('API key').fill('secret-fixture-value');
  await page.getByRole('button', { name: 'Save configuration' }).click();
  const review = page.getByRole('dialog', { name: 'Configure MCP service' });
  await expect(review).not.toContainText('secret-fixture-value');
  expect(update).toBeUndefined();
  await review.getByRole('button', { name: 'Confirm' }).click();
  await expect.poll(() => update).toBeTruthy();
  expect(update).toMatchObject({ baseVersion: 2, config: templates[1].config, credentials: { apiKey: 'secret-fixture-value' }, confirmed: true });
});

test('trusted MCP template preview requires credentials before a single install request', async ({ page }) => {
  let installed, previews = 0;
  const template = { templateId: 'trusted-one', version: '1.0.0', source: 'registry:trusted-one', name: 'Trusted one', setupState: 'needs-credentials', config: { transport: 'stdio', runnerProfileId: 'runner-one' }, credentialFields: [{ name: 'token', label: 'Access token', required: true }] };
  await page.route('**/api/v1/mcp', route => route.request().method() === 'POST' ? (installed = route.request().postDataJSON(), respond(route, { id: 'mcp-one', state: 'installed' }, 202)) : respond(route, { items: [] }));
  await page.route('**/api/v1/mcp/templates', route => respond(route, { items: [template] }));
  await page.route('**/api/v1/extensions/previews', route => { previews++; return respond(route, { previewId: 'preview-one', digest: 'sha256:fixture', trustState: 'verified', summary: { id: 'mcp-one', version: '1.0.0', templateId: template.templateId, templateVersion: template.version } }); });
  await page.goto('/mcp');
  await page.getByRole('button', { name: 'Choose' }).click();
  await expect.poll(() => previews).toBe(1);
  await expect(page.getByLabel('Access token')).toBeVisible();
  await page.getByLabel('Access token').fill('secret-install-once');
  await page.getByRole('button', { name: 'Install', exact: true }).last().click();
  const review = page.getByRole('dialog', { name: 'Install' });
  await expect(review).not.toContainText('secret-install-once');
  expect(installed).toBeUndefined();
  await review.getByRole('button', { name: 'Confirm' }).click();
  await expect.poll(() => installed).toBeTruthy();
  expect(installed).toMatchObject({ source: template.source, previewId: 'preview-one', previewDigest: 'sha256:fixture', templateId: template.templateId, templateVersion: template.version, config: template.config, credentials: { token: 'secret-install-once' }, confirmed: true });
});

test('settings uses the top-level projection and preserves an API version error', async ({ page }) => {
  let received;
  await page.route('**/api/v1/system/settings', route => {
    if (route.request().method() === 'PATCH') { received = route.request().postDataJSON(); return respond(route, { errorKey: 'version_conflict', message: 'Version conflict', requestId: 'req-1' }, 409); }
    return respond(route, { settingsVersion: '4', appearance: { appearanceMode: 'light', displayScale: 1 }, locale: { uiLocale: 'en-US' }, network: { proxyMode: 'off' }, grid: { enabled: false } });
  });
  await page.route('**/api/v1/system/context', route => respond(route, { contextVersion: '4' }));
  await page.goto('/settings');
  await expect(page.locator('form select[name="appearanceMode"]')).toBeVisible({ timeout: 3000 });
  await page.locator('form select[name="appearanceMode"]').selectOption('dark');
  await page.locator('form select[name="displayScale"]').selectOption('1.5');
  await page.locator('form').filter({ has: page.locator('select[name="appearanceMode"]') }).getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('alert')).toContainText('Version conflict · request req-1');
  expect(received).toMatchObject({ baseVersion: '4', domain: 'appearance', patch: { appearanceMode: 'dark', displayScale: 1.5 } });
  expect(received.patch.domain).toBeUndefined();
});

test('settings network and grid forms submit only declared writable fields', async ({ page }) => {
  const writes = [];
  const snapshot = { settingsVersion: '8', appearance: { appearanceMode: 'light', displayScale: 1 }, locale: { uiLocale: 'en-US' }, network: { proxyMode: 'system', effectiveRoute: 'system', affectedServices: [], restartRequired: false }, grid: { enabled: true, style: 'dot', spacing: 24, majorLineEvery: 5, showAxes: false, snapEnabled: true, snapTolerance: 8, colorToken: 'grid.default', opacity: 0.35 }, privacy: { telemetry: false }, appPermissions: [] };
  await page.route('**/api/v1/system/settings', route => {
    if (route.request().method() === 'PATCH') { writes.push(route.request().postDataJSON()); return respond(route, { ...snapshot, settingsVersion: String(8 + writes.length) }); }
    return respond(route, snapshot);
  });
  await page.route('**/api/v1/system/context', route => respond(route, { contextVersion: '8' }));
  await page.goto('/settings');
  await page.getByLabel('Choose').selectOption('network');
  await page.getByLabel('Proxy mode').selectOption('off');
  await page.locator('form').filter({ has: page.locator('select[name="proxyMode"]') }).getByRole('button', { name: 'Save changes' }).click();
  await expect.poll(() => writes.length).toBe(1);
  await expect(page.getByText('Settings version: 9')).toBeVisible();
  expect(writes[0]).toMatchObject({ domain: 'network', patch: { proxyMode: 'off' } });
  expect(writes[0].patch.effectiveRoute).toBeUndefined();
  await page.getByLabel('Choose').selectOption('grid');
  await page.getByLabel('Grid spacing').fill('32');
  await page.locator('form').filter({ has: page.locator('input[name="spacing"]') }).getByRole('button', { name: 'Save changes' }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1]).toMatchObject({ domain: 'grid', patch: { spacing: 32, enabled: true, style: 'dot', snapEnabled: true } });
  await page.getByLabel('Choose').selectOption('appPermissions');
  await expect(page.getByLabel('App permission rule')).toBeVisible();
});

test('manual proxy is stored separately and only its server reference enters Settings PATCH', async ({ page }) => {
  let provision, patch;
  const proxyRef = `proxy_${'a'.repeat(32)}`;
  await page.route('**/api/v1/system/settings', route => route.request().method() === 'PATCH' ? (patch = route.request().postDataJSON(), respond(route, { settingsVersion: '9', appearance: { appearanceMode: 'light', displayScale: 1 }, locale: { uiLocale: 'en-US' }, network: { proxyMode: 'manual', manualProxyRef: proxyRef, restartRequired: true }, grid: { enabled: false } })) : respond(route, { settingsVersion: '8', appearance: { appearanceMode: 'light', displayScale: 1 }, locale: { uiLocale: 'en-US' }, network: { proxyMode: 'off', restartRequired: false }, grid: { enabled: false } }));
  await page.route('**/api/v1/system/network/proxy-configurations', route => { provision = route.request().postDataJSON(); return respond(route, { requestId: provision.requestId, manualProxyRef: proxyRef, displayName: 'Office', status: 'stored', credentialStatus: 'configured' }, 201); });
  await page.route('**/api/v1/system/context', route => respond(route, { contextVersion: '8' }));
  await page.goto('/settings');
  await page.getByLabel('Choose').selectOption('network');
  await page.getByText('Add manual proxy configuration').click();
  await page.getByLabel('Display name').fill('Office');
  await page.getByLabel('Proxy endpoint').fill('https://proxy.example.test');
  await page.getByLabel('Proxy username (optional)').fill('alice');
  await page.getByLabel('Proxy password (optional)').fill('once-only');
  await page.getByRole('button', { name: 'Store proxy configuration' }).click();
  await expect(page.getByLabel('Proxy password (optional)')).toHaveValue('');
  expect(provision).toMatchObject({ displayName: 'Office', endpoint: 'https://proxy.example.test', username: 'alice', password: 'once-only' });
  await page.locator('select[name="proxyMode"]').selectOption('manual');
  await page.locator('form').filter({ has: page.locator('select[name="proxyMode"]') }).getByRole('button', { name: 'Save changes' }).click();
  await expect.poll(() => patch).toBeTruthy();
  expect(patch).toMatchObject({ baseVersion: '8', domain: 'network', patch: { proxyMode: 'manual', manualProxyRef: proxyRef } });
  expect(JSON.stringify(patch)).not.toContain('once-only');
  await expect(page.getByText('Pending service restart')).toBeVisible();
});

test('device revocation uses a management ID and ordinary logout uses singular session', async ({ page }) => {
  const managementId = `sm_${'a'.repeat(32)}`;
  let revokePath, logoutPath;
  await page.route('**/api/v1/system/settings', route => respond(route, { settingsVersion: '2', appearance: { appearanceMode: 'light', displayScale: 1 }, locale: { uiLocale: 'en-US' }, network: { proxyMode: 'off' }, grid: {} }));
  await page.route('**/api/v1/system/context', route => respond(route, { contextVersion: '2' }));
  await page.route('**/api/v1/identity/admin/sessions', route => respond(route, { items: [{ sessionManagementId: managementId, current: false, state: 'active', createdAt: '2026-10-01T00:00:00Z', expiresAt: '2026-10-03T00:00:00Z', sessionVersion: '1', deviceSummary: { host: 'web', label: 'Other browser' } }] }));
  await page.route(`**/api/v1/identity/admin/sessions/${managementId}`, route => { revokePath = route.request().url(); return respond(route, { requestId: route.request().postDataJSON().requestId, sessionManagementId: managementId, state: 'revoked', revokedAt: '2026-10-02T00:00:00Z', sessionVersion: '2' }); });
  await page.route('**/api/v1/identity/admin/session', route => route.request().method() === 'DELETE' ? (logoutPath = route.request().url(), route.fulfill({ status: 204 })) : respond(route, { sessionId: 'bearer-fixture', principalId: 'owner' }));
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect(page.getByText('Other browser')).toBeVisible();
  await page.getByRole('button', { name: 'Revoke' }).click();
  await page.getByRole('dialog', { name: 'Revoke device session' }).getByRole('button', { name: 'Confirm' }).click();
  expect(revokePath).toContain(managementId);
  expect(revokePath).not.toContain('bearer-fixture');
  await page.getByRole('button', { name: 'Sign out' }).click();
  expect(logoutPath).toMatch(/\/api\/v1\/identity\/admin\/session$/);
});

test('provider configuration submits paired protocol binding and version checked edits', async ({ page }) => {
  let created, updated;
  await page.route('**/api/v1/provider/accounts', route => route.request().method() === 'POST' ? respond(route, { accountId: 'account-1', version: '1', status: 'credential_pending' }, 201) : respond(route, { items: [] }));
  await page.route('**/api/v1/provider/configs', route => route.request().method() === 'POST' ? (created = route.request().postDataJSON(), respond(route, { id: 'config-1', version: '1', displayName: 'Fixture', baseUrl: 'https://example.test', status: 'draft', capabilityProtocolId: 'fixture.text', capabilityProtocolVersion: '1.0.0' }, 201)) : respond(route, { items: created ? [{ id: 'config-1', version: '1', displayName: 'Fixture', baseUrl: 'https://example.test', status: 'draft', capabilityProtocolId: 'fixture.text', capabilityProtocolVersion: '1.0.0' }] : [] }));
  await page.route('**/api/v1/provider/configs/config-1', route => { updated = route.request().postDataJSON(); return respond(route, { ...updated, id: 'config-1', version: '2' }); });
  await page.route('**/api/v1/provider/configs/config-1/models', route => respond(route, { items: [] }));
  await page.route('**/api/v1/provider/configs/config-1/model-policies', route => respond(route, { items: [] }));
  await page.route('**/api/v1/provider/capability-protocols', route => respond(route, { items: [{ id: 'fixture.text', version: '1.0.0', label: 'Fixture text', status: 'active' }] }));
  await page.goto('/providers');
  await page.getByText('Add provider').click();
  await page.getByLabel('Display name').fill('Fixture');
  await page.getByLabel('Base URL').fill('https://example.test');
  await page.getByLabel('Credential').fill('one-time');
  await page.getByLabel('Capability protocol version').selectOption('fixture.text@1.0.0');
  await page.locator('details form').getByRole('button', { name: 'Save changes' }).click();
  await expect.poll(() => created).toBeTruthy();
  expect(created).toMatchObject({ capabilityProtocolId: 'fixture.text', capabilityProtocolVersion: '1.0.0' });
  await page.getByRole('button', { name: 'Edit' }).click();
  await page.locator('form').filter({ has: page.locator('select[name="binding"]') }).last().getByRole('button', { name: 'Save changes' }).click();
  await expect.poll(() => updated).toBeTruthy();
  expect(updated).toMatchObject({ baseVersion: '1', displayName: 'Fixture', baseUrl: 'https://example.test' });
  expect(updated.capabilityProtocolId).toBeUndefined();
  expect(updated.capabilityProtocolVersion).toBeUndefined();
});

test('provider model policy submits classification with CAS and blocks unsupported text activation', async ({ page }) => {
  const writes = [];
  await page.route('**/api/v1/provider/accounts', route => respond(route, { items: [] }));
  await page.route('**/api/v1/provider/configs', route => respond(route, { items: [{ id: 'config-1', displayName: 'Fixture', version: '2', status: 'ready' }] }));
  await page.route('**/api/v1/provider/capability-protocols', route => respond(route, { items: [] }));
  await page.route('**/api/v1/provider/configs/config-1/models', route => respond(route, { items: [{ modelId: 'text-model', displayName: 'Text model', taskModes: ['text.chat'] }, { modelId: 'image-model', displayName: 'Image model', taskModes: ['image.generate'] }] }));
  await page.route('**/api/v1/provider/configs/config-1/model-policies', route => route.request().method() === 'POST' ? (writes.push(route.request().postDataJSON()), respond(route, { ...writes.at(-1), policyVersion: '5' })) : respond(route, { items: [{ modelId: 'text-model', enabled: true, assignedCapabilities: ['text'], defaultFor: [], policyVersion: '4' }] }));
  await page.goto('/providers');
  const text = page.locator('.record-list li').filter({ has: page.getByText('text-model', { exact: true }) });
  await text.getByRole('checkbox', { name: 'Default text model' }).check();
  await text.getByRole('button', { name: 'Save changes' }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toMatchObject({ modelId: 'text-model', enabled: true, assignedCapabilities: ['text'], defaultFor: ['text'], baseVersion: '4' });
  const image = page.locator('.record-list li').filter({ has: page.getByText('image-model', { exact: true }) });
  await expect(image.getByRole('checkbox', { name: 'Text capability' })).toBeDisabled();
  await image.getByRole('checkbox', { name: 'Enable' }).check();
  await image.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('alert')).toContainText('does not declare text.chat');
  expect(writes).toHaveLength(1);
});

test('protocol publish and state use explicit server tickets bound to the same request', async ({ page }) => {
  const fixture = { id: 'fixture.text', version: '1.0.0', registryVersion: 1, status: 'active', label: 'Fixture', modelProfiles: { text: { modelNames: ['fixture-model'] } } };
  let visible = false, issuePublish, publish, issueState, state;
  await page.route('**/api/v1/provider/protocols', route => respond(route, { items: [{ protocolType: 'openai-compatible', adapterVersion: 'v1', status: 'active' }] }));
  await page.route('**/api/v1/provider/capability-protocols', route => {
    if (route.request().method() === 'POST') return respond(route, { digest: 'sha256:fixture' });
    return respond(route, { items: visible ? [fixture] : [] });
  });
  await page.route('**/api/v1/provider/capability-protocols/confirmations', route => {
    const body = route.request().postDataJSON();
    if (body.operation === 'provider.protocol.publish') issuePublish = body;
    else issueState = body;
    return respond(route, { confirmationId: body.operation === 'provider.protocol.publish' ? 'publish-ticket' : 'state-ticket', requestId: body.requestId, digest: body.validationDigest || 'state-digest', expiresAt: '2030-01-01T00:00:00Z' }, 201);
  });
  await page.route('**/api/v1/provider/capability-protocols/fixture.text/versions', route => { publish = route.request().postDataJSON(); visible = true; return respond(route, fixture, 201); });
  await page.route('**/api/v1/provider/capability-protocols/fixture.text/versions/1.0.0/state', route => { state = route.request().postDataJSON(); visible = false; return respond(route, { ...fixture, status: 'disabled', registryVersion: 2 }); });
  await page.goto('/protocols');
  await page.getByLabel('Protocol ID').fill('fixture.text');
  await page.getByLabel('Display name').fill('Fixture');
  await page.getByLabel('Model').fill('fixture-model');
  await page.getByRole('button', { name: 'Validate protocol' }).click();
  await expect(page.getByRole('button', { name: 'Publish protocol' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Confirm and issue ticket' }).click();
  await page.getByRole('button', { name: 'Publish protocol' }).click();
  expect(publish).toMatchObject({ requestId: issuePublish.requestId, confirmationId: 'publish-ticket', validationDigest: issuePublish.validationDigest, declaration: issuePublish.declaration });
  await page.getByRole('button', { name: 'Disable' }).click();
  await page.getByRole('dialog', { name: 'Review protocol change' }).getByRole('button', { name: 'Confirm and issue ticket' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm Disable' }).click();
  expect(state).toMatchObject({ requestId: issueState.requestId, baseVersion: 1, state: 'disabled', confirmationId: 'state-ticket' });
});

test('protocol ticket retries preserve request identity and expired tickets never publish', async ({ page }) => {
  const digest = 'a'.repeat(64);
  const issueIds = [];
  let publications = 0;
  await page.route('**/api/v1/provider/protocols', route => respond(route, { items: [] }));
  await page.route('**/api/v1/provider/capability-protocols', route => route.request().method() === 'POST' ? respond(route, { digest }) : respond(route, { items: [] }));
  await page.route('**/api/v1/provider/capability-protocols/confirmations', route => {
    const body = route.request().postDataJSON();
    issueIds.push(body.requestId);
    return issueIds.length === 1 ? route.abort('failed') : respond(route, { confirmationId: 'ticket', requestId: body.requestId, digest, expiresAt: '2020-01-01T00:00:00Z' }, 201);
  });
  await page.route('**/api/v1/provider/capability-protocols/retry.text/versions', route => { publications++; return respond(route, {}); });
  await page.goto('/protocols');
  await page.getByLabel('Protocol ID').fill('retry.text');
  await page.getByLabel('Display name').fill('Retry');
  await page.getByLabel('Model').fill('retry-model');
  await page.getByRole('button', { name: 'Validate protocol' }).click();
  const issue = page.getByRole('button', { name: 'Confirm and issue ticket' });
  await issue.click();
  await expect(page.getByRole('alert')).toBeVisible();
  await issue.click();
  await expect(page.getByRole('alert')).toContainText('Confirmation ticket expired');
  expect(issueIds).toHaveLength(2);
  expect(issueIds[1]).toBe(issueIds[0]);
  await expect(page.getByRole('button', { name: 'Publish protocol' })).toHaveCount(0);
  expect(publications).toBe(0);
});

test('catalog mutation carries selected release and shows unavailable extension route', async ({ page }) => {
  let received;
  await page.route('**/api/v1/apps', route => respond(route, { items: [{ appId: 'example.app', version: '1.2.3', build: 7, releaseChannel: 'beta', catalogState: 'approved' }] }));
  await page.route('**/api/v1/apps/example.app/deployment', route => respond(route, { appId: 'example.app', state: 'active', versionNumber: 2 }));
  await page.route('**/api/v1/apps/example.app/install', route => { received = route.request().postDataJSON(); return respond(route, { appId: 'example.app', state: 'installed', dataRetained: true }); });
  await page.route('**/api/v1/skills', route => respond(route, { errorKey: 'not_available', message: 'Extension service unavailable', requestId: 'req-2' }, 503));
  await page.goto('/catalog');
  await page.getByRole('button', { name: 'Install', exact: true }).click();
  expect(received).toMatchObject({ version: '1.2.3', build: 7, releaseChannel: 'beta', baseVersion: 2 });
  await page.getByRole('link', { name: 'Skills' }).click();
  await expect(page.getByRole('alert')).toContainText('Extension service unavailable · request req-2');
});

test('catalog selects a release and a sandboxed app bridges only a declared capability', async ({ page }) => {
  const instanceId = '33333333-3333-4333-8333-333333333333';
  let bridgeCalls = 0;
  await page.route('**/api/v1/apps', route => respond(route, { items: [
    { appId: 'example.app', version: '1.0.0', build: 1, releaseChannel: 'stable', catalogState: 'approved' },
    { appId: 'example.app', version: '2.0.0', build: 2, releaseChannel: 'beta', catalogState: 'approved' },
  ] }));
  await page.route('**/api/v1/apps/example.app/deployment', route => respond(route, { appId: 'example.app', state: 'active', versionNumber: 3 }));
  await page.route('**/api/v1/apps/example.app/launch', route => respond(route, { instanceId, bridgeVersion: 1, isolation: 'opaque-origin-sandbox', declaredCapabilities: ['dgos.model.list'], expiresAt: '2030-01-01T00:00:00Z', entrypoint: '/api/v1/apps/example.app/resources/index.html?launchTicket=fixture' }));
  await page.route('**/api/v1/apps/example.app/resources/index.html**', route => route.fulfill({ status: 200, contentType: 'text/html', body: `<script>window.addEventListener('message', event => { if (event.data.type === 'dgos.host.hello') { parent.postMessage({type:'dgos.app.ready',instanceId:event.data.instanceId,bridgeVersion:1},event.origin); parent.postMessage({type:'dgos.app.invoke',instanceId:event.data.instanceId,requestId:'77777777-7777-4777-8777-777777777777',capability:'dgos.model.list',input:{}},event.origin); window.invoke = (capability, requestId) => parent.postMessage({type:'dgos.app.invoke',instanceId:event.data.instanceId,requestId,capability,input:{}},event.origin); } if (event.data.type === 'dgos.host.result') document.body.textContent = event.data.error?.message || JSON.stringify(event.data.result); });</script>` }));
  await page.route('**/api/v1/apps/example.app/bridge', route => { bridgeCalls++; return respond(route, { errorKey: 'permission_denied', message: 'Permission denied', requestId: 'req-bridge' }, 403); });
  await page.goto('/catalog');
  await page.getByLabel('Version').selectOption('2.0.0:2:beta');
  await page.getByRole('button', { name: 'Launch' }).click();
  const frame = page.frameLocator('iframe[title="example.app"]');
  await expect(page.locator('.app-sandbox')).toHaveAttribute('sandbox', 'allow-scripts');
  await expect(page.locator('.app-sandbox')).toHaveAttribute('referrerpolicy', 'no-referrer');
  await expect(page.locator('.dgos-status').last()).toHaveText('ready');
  await expect.poll(() => bridgeCalls).toBe(1);
  await frame.locator('body').evaluate(() => window.invoke('unlisted.capability', '44444444-4444-4444-8444-444444444444'));
  await expect(frame.locator('body')).toContainText('Capability unavailable');
  expect(bridgeCalls).toBe(1);
  await frame.locator('body').evaluate(() => parent.postMessage({ type: 'dgos.app.invoke', instanceId: '33333333-3333-4333-8333-333333333333', requestId: '66666666-6666-4666-8666-666666666666', capability: 'dgos.model.list', input: { modelRef: 'old-alias' } }, location.origin));
  await expect(frame.locator('body')).toContainText('Capability unavailable');
  expect(bridgeCalls).toBe(1);
  await frame.locator('body').evaluate(() => window.invoke('dgos.model.list', '55555555-5555-4555-8555-555555555555'));
  await expect(frame.locator('body')).toContainText('Permission denied');
  expect(bridgeCalls).toBe(2);
});

test('context permission revocation keeps the API error key and stops app polling', async ({ page }) => {
  const instanceId = '33333333-3333-4333-8333-333333333333';
  let contextReads = 0;
  await page.route('**/api/v1/apps', route => respond(route, { items: [{ appId: 'dgos.ai-workbench', version: '1.0.1', build: 2, releaseChannel: 'stable', catalogState: 'approved' }] }));
  await page.route('**/api/v1/apps/dgos.ai-workbench/deployment', route => respond(route, { appId: 'dgos.ai-workbench', state: 'active', versionNumber: 2 }));
  await page.route('**/api/v1/apps/dgos.ai-workbench/launch', route => respond(route, { instanceId, bridgeVersion: 1, isolation: 'opaque-origin-sandbox', declaredCapabilities: ['dgos.system.context.read', 'dgos.system.context.events'], expiresAt: '2030-01-01T00:00:00Z', entrypoint: '/api/v1/apps/dgos.ai-workbench/resources/index.html?launchTicket=fixture' }));
  await page.route('**/api/v1/apps/dgos.ai-workbench/resources/index.html**', route => route.fulfill({ status: 200, contentType: 'text/html', body: `<span id="state"></span><script>let timer;window.addEventListener('message',event=>{const data=event.data;if(data.type==='dgos.host.hello'){window.instance=data.instanceId;parent.postMessage({type:'dgos.app.ready',instanceId:window.instance,bridgeVersion:1},event.origin);timer=setInterval(()=>parent.postMessage({type:'dgos.app.invoke',instanceId:window.instance,requestId:crypto.randomUUID(),capability:'dgos.system.context.read',input:{}},event.origin),60)}if(data.type==='dgos.host.result'&&data.error){document.getElementById('state').textContent=data.error.errorKey+':'+data.error.requestId;if(data.error.errorKey==='permission_denied')clearInterval(timer)}});</script>` }));
  await page.route('**/api/v1/apps/dgos.ai-workbench/bridge', route => { contextReads++; return respond(route, { errorKey: 'permission_denied', message: 'Permission denied', requestId: 'req-context' }, 403); });
  await page.goto('/catalog');
  await page.getByRole('button', { name: 'Launch' }).click();
  await expect(page.frameLocator('iframe[title="dgos.ai-workbench"]').locator('#state')).toHaveText('permission_denied:req-context');
  const stoppedAt = contextReads;
  await page.waitForTimeout(300);
  expect(contextReads).toBe(stoppedAt);
});

test('invalid app session closes the iframe and stops pending bridge traffic', async ({ page }) => {
  const instanceId = '33333333-3333-4333-8333-333333333333';
  let bridgeCalls = 0;
  await page.route('**/api/v1/apps', route => respond(route, { items: [{ appId: 'dgos.ai-workbench', version: '1.0.1', build: 2, releaseChannel: 'stable', catalogState: 'approved' }] }));
  await page.route('**/api/v1/apps/dgos.ai-workbench/deployment', route => respond(route, { appId: 'dgos.ai-workbench', state: 'active', versionNumber: 2 }));
  await page.route('**/api/v1/apps/dgos.ai-workbench/launch', route => respond(route, { instanceId, bridgeVersion: 1, isolation: 'opaque-origin-sandbox', declaredCapabilities: ['dgos.system.context.read'], expiresAt: '2030-01-01T00:00:00Z', entrypoint: '/api/v1/apps/dgos.ai-workbench/resources/index.html?launchTicket=fixture' }));
  await page.route('**/api/v1/apps/dgos.ai-workbench/resources/index.html**', route => route.fulfill({ status: 200, contentType: 'text/html', body: `<script>window.addEventListener('message',event=>{if(event.data.type==='dgos.host.hello'){window.instance=event.data.instanceId;parent.postMessage({type:'dgos.app.ready',instanceId:window.instance,bridgeVersion:1},event.origin);setInterval(()=>parent.postMessage({type:'dgos.app.invoke',instanceId:window.instance,requestId:crypto.randomUUID(),capability:'dgos.system.context.read',input:{}},event.origin),60)}})</script>` }));
  await page.route('**/api/v1/apps/dgos.ai-workbench/bridge', route => { bridgeCalls++; return respond(route, { errorKey: 'session_invalid', message: 'Session expired', requestId: 'req-session-invalid' }, 401); });
  await page.goto('/catalog');
  await page.getByRole('button', { name: 'Launch' }).click();
  await expect(page.getByRole('alert')).toContainText('Session expired · request req-session-invalid');
  await expect(page.locator('iframe[title="dgos.ai-workbench"]')).toHaveCount(0);
  const stoppedAt = bridgeCalls;
  await page.waitForTimeout(300);
  expect(bridgeCalls).toBe(stoppedAt);
});

test('catalog resumes an existing task without submitting another task', async ({ page }) => {
  const instanceId = '33333333-3333-4333-8333-333333333333';
  const capabilities = [];
  await page.route('**/api/v1/apps', route => respond(route, { items: [{ appId: 'dgos.ai-workbench', version: '1.0.0', build: 1, releaseChannel: 'stable', catalogState: 'approved' }] }));
  await page.route('**/api/v1/apps/dgos.ai-workbench/deployment', route => respond(route, { appId: 'dgos.ai-workbench', state: 'active', versionNumber: 1 }));
  await page.route('**/api/v1/apps/dgos.ai-workbench/launch', route => respond(route, { instanceId, bridgeVersion: 1, isolation: 'opaque-origin-sandbox', declaredCapabilities: ['dgos.aiTask.get', 'dgos.aiTask.events', 'dgos.artifact.read'], expiresAt: '2030-01-01T00:00:00Z', entrypoint: '/api/v1/apps/dgos.ai-workbench/resources/index.html?launchTicket=fixture' }));
  await page.route('**/api/v1/apps/dgos.ai-workbench/resources/index.html**', route => route.fulfill({ status: 200, contentType: 'text/html', body: `<script>window.addEventListener('message', event => { if (event.data.type === 'dgos.host.hello') parent.postMessage({type:'dgos.app.ready',instanceId:event.data.instanceId,bridgeVersion:1},event.origin); });</script>` }));
  await page.route('**/api/v1/apps/dgos.ai-workbench/bridge', route => {
    const body = route.request().postDataJSON();
    capabilities.push(body.capability);
    if (body.capability === 'dgos.aiTask.get') return respond(route, { taskId: 'task-existing', status: 'succeeded', text: 'existing result', artifactIds: ['artifact-existing'] });
    if (body.capability === 'dgos.aiTask.events') return respond(route, { items: [{ type: 'text.delta', delta: 'existing result' }] });
    if (body.capability === 'dgos.artifact.read') return respond(route, { content: 'existing artifact' });
    return respond(route, { errorKey: 'unexpected_capability', message: 'Unexpected capability' }, 400);
  });
  await page.goto('/catalog');
  await page.getByRole('button', { name: 'Launch' }).click();
  await expect(page.locator('.dgos-status').last()).toHaveText('ready');
  await page.getByLabel('Task ID').fill('task-existing');
  await page.getByRole('button', { name: 'Re-query / resume' }).click();
  await expect(page.locator('.task-output').first()).toHaveText('existing result');
  await expect(page.locator('.task-output').last()).toHaveText('existing artifact');
  expect(capabilities).toEqual(['dgos.aiTask.get', 'dgos.aiTask.events', 'dgos.artifact.read']);
});

test('catalog records a public submitted task reference and auto-recovers after a new launch', async ({ page }) => {
  const instanceId = '33333333-3333-4333-8333-333333333333';
  const calls = [];
  await page.route('**/api/v1/apps', route => respond(route, { items: [{ appId: 'dgos.ai-workbench', version: '1.0.0', build: 1, releaseChannel: 'stable', catalogState: 'approved' }] }));
  await page.route('**/api/v1/apps/dgos.ai-workbench/deployment', route => respond(route, { appId: 'dgos.ai-workbench', state: 'active', versionNumber: 1 }));
  await page.route('**/api/v1/apps/dgos.ai-workbench/launch', route => respond(route, { instanceId, bridgeVersion: 1, isolation: 'opaque-origin-sandbox', declaredCapabilities: ['dgos.aiTask.submit', 'dgos.aiTask.get', 'dgos.aiTask.events', 'dgos.artifact.read'], expiresAt: '2030-01-01T00:00:00Z', entrypoint: '/api/v1/apps/dgos.ai-workbench/resources/index.html?launchTicket=fixture' }));
  await page.route('**/api/v1/apps/dgos.ai-workbench/resources/index.html**', route => route.fulfill({ status: 200, contentType: 'text/html', body: `<script>window.addEventListener('message',event=>{if(event.data.type==='dgos.host.hello'){window.instanceId=event.data.instanceId;parent.postMessage({type:'dgos.app.ready',instanceId:window.instanceId,bridgeVersion:1},event.origin)}});window.submit=()=>parent.postMessage({type:'dgos.app.invoke',instanceId:window.instanceId,requestId:'77777777-7777-4777-8777-777777777777',capability:'dgos.aiTask.submit',input:{target:'text',intent:'text.chat',input:{text:'fixture prompt'},options:{providerConfigId:'config-1',modelId:'model-1'}}},'*')</script>` }));
  await page.route('**/api/v1/apps/dgos.ai-workbench/bridge', route => {
    const capability = route.request().postDataJSON().capability;
    calls.push(capability);
    if (capability === 'dgos.aiTask.submit') return respond(route, { taskId: 'task-public', status: 'queued' }, 202);
    if (capability === 'dgos.aiTask.get') return respond(route, { taskId: 'task-public', status: 'succeeded', text: 'previous result', artifactIds: ['artifact-1'] });
    if (capability === 'dgos.aiTask.events') return respond(route, { items: [{ type: 'text.delta', delta: 'previous result' }] });
    return respond(route, { artifactId: 'artifact-1', content: 'previous artifact' });
  });
  await page.goto('/catalog');
  await page.getByRole('button', { name: 'Launch' }).click();
  await expect(page.locator('.dgos-status').last()).toHaveText('ready');
  await page.frameLocator('iframe[title="dgos.ai-workbench"]').locator('body').evaluate(() => window.submit());
  await expect(page.getByLabel('Task ID')).toHaveValue('task-public');
  await page.reload();
  await page.getByRole('button', { name: 'Launch' }).click();
  await expect(page.locator('.task-output').first()).toContainText('previous result');
  await expect(page.locator('.task-output').last()).toContainText('previous artifact');
  expect(calls).toEqual(['dgos.aiTask.submit', 'dgos.aiTask.get', 'dgos.aiTask.events', 'dgos.artifact.read']);
  const persisted = await page.evaluate(() => ({ ...localStorage }));
  expect(persisted['dgos.ui.appTask.owner.dgos.ai-workbench']).toBe('task-public');
  expect(JSON.stringify(persisted)).not.toContain('fixture prompt');
  expect(JSON.stringify(persisted)).not.toContain('launchTicket');
});

test('assistant executes the exact parsed input used to create its plan', async ({ page }) => {
  let planned, executed;
  await page.route('**/api/v1/actions', route => respond(route, { items: [{ actionId: 'system.settings.patch', appId: 'dgos.system', requiredCapabilities: ['system.settings.write'], riskLevel: 'medium', inputSchema: { properties: { patch: { type: 'object' } }, required: ['patch'] } }] }));
  await page.route('**/api/v1/audit/events**', route => respond(route, { items: [] }));
  await page.route('**/api/v1/permissions/check', route => respond(route, { decision: 'allow', capability: 'system.settings.write' }));
  await page.route('**/api/v1/actions/system.settings.patch/plan', route => { planned = route.request().postDataJSON(); return respond(route, { planId: 'plan-1', riskLevel: 'medium', confirmationRequired: true, permission: { decision: 'allow' } }); });
  await page.route('**/api/v1/actions/system.settings.patch/execute', route => { executed = route.request().postDataJSON(); return respond(route, { runId: 'run-1', state: 'succeeded' }, 202); });
  await page.route('**/api/v1/action-runs/run-1', route => respond(route, { runId: 'run-1', state: 'succeeded' }));
  await page.goto('/assistant');
  await page.getByRole('textbox', { name: 'patch' }).fill('{"domain":"grid","value":{"enabled":true}}');
  await page.getByRole('button', { name: 'Create plan' }).click();
  await page.getByRole('button', { name: 'Confirm and execute' }).click();
  expect(executed.input).toEqual(planned.input);
  expect(executed.input.patch).toEqual({domain:'grid',value:{enabled:true}});
});

test('assistant requests permission, requires explicit allow, and replans before execution', async ({ page }) => {
  let requests = 0, decisions = 0, plans = 0, executes = 0;
  await page.route('**/api/v1/actions', route => respond(route, { items: [{ actionId: 'system.navigate.system.settings', actionVersion: '1', appId: 'dgos.system', requiredCapabilities: ['system.navigate'], inputSchema: { properties: { target: { type: 'string' } } } }] }));
  await page.route('**/api/v1/audit/events**', route => respond(route, { items: [] }));
  await page.route('**/api/v1/actions/resolve', route => respond(route, { candidates: [{ actionId: 'system.navigate.system.settings', actionVersion: '1', input: { target: 'system.settings' }, permission: 'ask', risk: 'read', executable: false }] }));
  await page.route('**/api/v1/actions/system.navigate.system.settings/plan', route => { plans++; return respond(route, { planId: `plan-${plans}`, permission: { decision: decisions ? 'allow' : 'ask' }, inputSummary: ['target'] }); });
  await page.route('**/api/v1/permissions/check', route => respond(route, { decision: decisions ? 'allow' : 'ask', capability: 'system.navigate' }));
  await page.route('**/api/v1/permissions/request', route => { requests++; return respond(route, { decision: 'ask', confirmationRequired: true, confirmationId: 'permission-1' }, 202); });
  await page.route('**/api/v1/system/settings', route => {
    if (route.request().method() === 'GET') return respond(route, { settingsVersion: '7', appPermissions: [] });
    decisions++;
    expect(route.request().postDataJSON()).toMatchObject({ baseVersion: '7', domain: 'appPermissions', patch: { rules: [{ appId: 'dgos.system', capability: 'system.navigate', decision: 'allow', subjectId: 'owner', subjectType: 'user', scope: { value: '*' } }] } });
    return respond(route, { settingsVersion: '8', appPermissions: [{ appId: 'dgos.system', capability: 'system.navigate', decision: 'allow' }] });
  });
  await page.route('**/api/v1/actions/system.navigate.system.settings/execute', route => { executes++; return respond(route, { runId: 'run-1', state: 'queued' }, 202); });
  await page.route('**/api/v1/action-runs/run-1', route => respond(route, { runId: 'run-1', state: 'queued' }));
  await page.goto('/assistant');
  await page.getByLabel('What do you want to do?').fill('open settings');
  await page.getByRole('button', { name: 'Find actions' }).click();
  await page.getByRole('button', { name: 'Choose' }).click();
  await page.getByRole('button', { name: 'Create plan' }).click();
  await expect(page.getByRole('button', { name: 'Confirm and execute' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Request permission' }).click();
  expect(requests).toBe(1);
  expect(executes).toBe(0);
  await page.getByRole('button', { name: 'Allow this capability' }).click();
  await expect(page.getByRole('button', { name: 'Confirm and execute' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Create plan' }).click();
  await page.getByRole('button', { name: 'Confirm and execute' }).click();
  expect(plans).toBe(2);
  expect(executes).toBe(1);
});

test('assistant checks every declared capability and blocks denied or undeclared grants', async ({ page }) => {
  const checked = [], requested = [], decisions = [];
  let plans = 0, executes = 0;
  const declaration = { actionId: 'system.settings.appPermissions.patch', actionVersion: '1', appId: 'dgos.system', requiredCapabilities: ['system.settings.write', 'permission.manage'], inputSchema: { properties: {} } };
  await page.route('**/api/v1/actions', route => respond(route, { items: [declaration] }));
  await page.route('**/api/v1/audit/events**', route => respond(route, { items: [] }));
  await page.route('**/api/v1/actions/system.settings.appPermissions.patch/plan', route => { plans++; return respond(route, { planId: `plan-${plans}`, permission: { decision: 'ask' }, inputSummary: [] }); });
  await page.route('**/api/v1/permissions/check', route => { const body = route.request().postDataJSON(); checked.push(body.capability); return respond(route, { decision: body.capability === 'permission.manage' && decisions.length === 0 ? 'deny' : 'ask' }); });
  await page.route('**/api/v1/permissions/request', route => { requested.push(route.request().postDataJSON()); return respond(route, { decision: 'ask', confirmationRequired: true }, 202); });
  await page.route('**/api/v1/system/settings', route => {
    if (route.request().method() === 'GET') return respond(route, { settingsVersion: '7', appPermissions: [] });
    decisions.push(route.request().postDataJSON());
    return respond(route, { settingsVersion: '8', appPermissions: [{ appId: 'dgos.system', capability: 'system.settings.write', decision: 'allow' }] });
  });
  await page.route('**/api/v1/actions/system.settings.appPermissions.patch/execute', route => { executes++; return respond(route, { runId: 'run-1' }, 202); });
  await page.goto('/assistant');
  await page.getByRole('button', { name: 'Create plan' }).click();
  await expect(page.getByText('permission.manage · Permission: deny')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm and execute' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Request permission' }).click();
  await page.getByRole('button', { name: 'Allow this capability' }).click();
  await expect.poll(() => decisions.length).toBe(1);
  expect(checked).toEqual(['system.settings.write', 'permission.manage']);
  expect(requested.map(item => item.capability)).toEqual(['system.settings.write']);
  expect(decisions.map(item => item.patch.rules[0].capability)).toEqual(['system.settings.write']);
  expect(executes).toBe(0);
  declaration.requiredCapabilities = undefined;
  await page.reload();
  await page.getByRole('button', { name: 'Create plan' }).click();
  await expect(page.getByRole('button', { name: 'Confirm and execute' })).toHaveCount(0);
  expect(executes).toBe(0);
});

test('assistant grants two declared capabilities separately through versioned System settings', async ({ page }) => {
  const capabilities = ['system.settings.write', 'permission.manage'];
  const allowed = new Set(), requested = [], patches = [];
  let plans = 0, executes = 0;
  await page.route('**/api/v1/actions', route => respond(route, { items: [{ actionId: 'system.settings.appPermissions.patch', actionVersion: '1', appId: 'dgos.system', requiredCapabilities: capabilities, inputSchema: { properties: {} } }] }));
  await page.route('**/api/v1/audit/events**', route => respond(route, { items: [] }));
  await page.route('**/api/v1/actions/system.settings.appPermissions.patch/plan', route => { plans++; return respond(route, { planId: `plan-${plans}`, permission: { decision: allowed.size === 2 ? 'allow' : 'ask' }, inputSummary: [] }); });
  await page.route('**/api/v1/permissions/check', route => respond(route, { decision: allowed.has(route.request().postDataJSON().capability) ? 'allow' : 'ask' }));
  await page.route('**/api/v1/permissions/request', route => { requested.push(route.request().postDataJSON().capability); return respond(route, { decision: 'ask', confirmationRequired: true }, 202); });
  await page.route('**/api/v1/system/settings', route => {
    if (route.request().method() === 'GET') return respond(route, { settingsVersion: String(7 + patches.length), appPermissions: [...allowed].map(capability => ({ appId: 'dgos.system', capability, decision: 'allow' })) });
    const body = route.request().postDataJSON();
    expect(body.baseVersion).toBe(String(7 + patches.length));
    expect(body.domain).toBe('appPermissions');
    const rule = body.patch.rules[0];
    expect(rule).toMatchObject({ appId: 'dgos.system', subjectId: 'owner', subjectType: 'user', scope: { value: '*' }, decision: 'allow' });
    patches.push(rule.capability); allowed.add(rule.capability);
    return respond(route, { settingsVersion: String(7 + patches.length), appPermissions: [...allowed].map(capability => ({ appId: 'dgos.system', capability, decision: 'allow' })) });
  });
  await page.route('**/api/v1/actions/system.settings.appPermissions.patch/execute', route => { executes++; return respond(route, { runId: 'run-two', state: 'queued' }, 202); });
  await page.route('**/api/v1/action-runs/run-two', route => respond(route, { runId: 'run-two', state: 'queued' }));
  await page.goto('/assistant');
  for (const capability of capabilities) {
    await page.getByRole('button', { name: 'Create plan' }).click();
    await expect(page.getByRole('button', { name: 'Confirm and execute' })).toHaveCount(0);
    const line = page.locator('.result').filter({ hasText: `${capability} · Permission: ask` }).last();
    await line.getByRole('button', { name: 'Request permission' }).click();
    await expect.poll(() => requested.includes(capability)).toBe(true);
    await line.getByRole('button', { name: 'Allow this capability' }).click();
    await expect.poll(() => patches.includes(capability)).toBe(true);
    await expect(page.getByRole('button', { name: 'Confirm and execute' })).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Create plan' }).click();
  await page.getByRole('button', { name: 'Confirm and execute' }).click();
  expect(requested).toEqual(capabilities);
  expect(patches).toEqual(capabilities);
  expect(plans).toBe(3);
  expect(executes).toBe(1);
});

test('provider requires a successful version matched probe before explicit ready', async ({ page }) => {
  let statePayload;
  await page.route('**/api/v1/provider/accounts', route => respond(route, { items: [{ accountId: 'account-1', displayName: 'Fixture', ownerId: 'owner', status: 'credential_pending', credentialState: 'configured', version: '2' }] }));
  await page.route('**/api/v1/provider/configs', route => respond(route, { items: [] }));
  await page.route('**/api/v1/provider/connection-tests', route => respond(route, { testId: 'test-1', accountId: 'account-1', accountVersion: '2', status: 'queued' }, 202));
  await page.route('**/api/v1/provider/connection-tests/test-1', route => respond(route, { testId: 'test-1', accountId: 'account-1', accountVersion: '2', status: 'succeeded' }));
  await page.route('**/api/v1/provider/accounts/account-1/state', route => { statePayload = route.request().postDataJSON(); return respond(route, { accountId: 'account-1', status: 'ready', version: '3' }); });
  await page.goto('/providers');
  await expect(page.getByRole('button', { name: 'Enable' })).toBeDisabled();
  await page.getByRole('button', { name: 'Connection test' }).click();
  await expect(page.getByRole('button', { name: 'Enable' })).toBeEnabled();
  await page.getByRole('button', { name: 'Enable' }).click();
  expect(statePayload).toMatchObject({ state: 'ready', baseVersion: '2', connectionTestId: 'test-1' });
});

test('extension confirmation freezes the same request and input for invocation', async ({ page }) => {
  let confirmation, invocation;
  await page.route('**/api/v1/mcp', route => respond(route, { items: [{ id: 'mcp-1', displayName: 'Fixture', version: '1', stateVersion: '1', state: 'enabled', connectionState: 'connected' }] }));
  await page.route('**/api/v1/mcp/mcp-1/tools', route => respond(route, { items: [{ operationId: 'search', permission: 'mcp.execute', risk: 'high', sideEffects: true }] }));
  await page.route('**/api/v1/extensions/confirmations', route => { confirmation = route.request().postDataJSON(); return respond(route, { confirmationId: 'ticket-1', requestId: confirmation.requestId, executable: false }, 201); });
  await page.route('**/api/v1/extensions/runs', route => { invocation = route.request().postDataJSON(); return respond(route, { runId: 'run-1', state: 'queued' }, 202); });
  await page.route('**/api/v1/extensions/runs/run-1', route => respond(route, { runId: 'run-1', state: 'queued' }));
  await page.goto('/mcp');
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await page.getByRole('button', { name: 'Choose' }).click();
  await page.getByLabel('Calling app ID').fill('app-1');
  await page.getByLabel('Input JSON').fill('{"query":"hello"}');
  await page.getByRole('button', { name: 'Confirm and issue ticket' }).click();
  await page.getByRole('button', { name: 'Invoke tool' }).click();
  expect(invocation).toMatchObject({ requestId: confirmation.requestId, confirmationId: 'ticket-1', input: confirmation.input });
});

test('Chinese language covers the developer and extension operation controls', async ({ page }) => {
  await page.route('**/api/v1/apps', route => respond(route, { items: [] }));
  await page.route('**/api/v1/mcp', route => respond(route, { items: [{ id: 'mcp-1', displayName: 'Fixture', version: '1', stateVersion: '1', state: 'enabled', connectionState: 'connected' }] }));
  await page.goto('/developer');
  await page.getByLabel('Language').selectOption('zh');
  await expect(page.getByRole('heading', { name: '提交签名应用包' })).toBeVisible();
  await expect(page.getByLabel('应用包封装 JSON')).toBeVisible();
  await page.getByRole('link', { name: 'MCP 服务' }).click();
  await expect(page.getByRole('heading', { name: '已安装 MCP 服务' })).toBeVisible();
  await expect(page.getByRole('button', { name: '断开连接' })).toBeVisible();
  await expect(page.getByRole('button', { name: '工具' })).toBeVisible();
});

test('extension install stops after an unavailable preview endpoint', async ({ page }) => {
  let installs=0;
  await page.route('**/api/v1/skills', route => { if(route.request().method()==='POST') installs+=1; return respond(route,{items:[]}); });
  await page.route('**/api/v1/extensions/previews', route => respond(route,{errorKey:'not_available',message:'Preview unavailable',requestId:'req-preview'},503));
  await page.goto('/skills');
  await page.getByLabel('Source').fill('registry:fixture');
  await page.getByRole('button', { name: 'Preview' }).click();
  await expect(page.getByRole('alert')).toContainText('Preview unavailable · request req-preview');
  expect(installs).toBe(0);
});

test('shell keeps theme, language and scale across navigation and reload', async ({ page }) => {
  await page.goto('/desktop');
  await page.getByLabel('Theme').selectOption('dark');
  await page.getByLabel('Language').selectOption('zh');
  await page.getByLabel('显示倍率').selectOption('150');
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await expect(page.locator('html')).toHaveAttribute('lang','zh');
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog', { name: '打开命令面板' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'AI 工作台' }).click();
  await expect(page).toHaveURL(/\/ai-tasks$/);
  await page.reload();
  await expect(page.getByLabel('显示倍率')).toHaveValue('150');
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
});

test('login sends principalHint and remembers only the principal ID', async ({ page }) => {
  await page.unroute('**/api/v1/identity/admin/session');
  let sessionActive = false;
  let loginBody;
  await page.route('**/api/v1/identity/admin/session', route => respond(route, sessionActive ? {sessionId:'session-1',principalId:'admin-1'} : {errorKey:'authentication_required'}, sessionActive ? 200 : 401));
  await page.route('**/api/v1/identity/admin/login', route => { loginBody = route.request().postDataJSON(); sessionActive = true; return respond(route,{sessionId:'session-1',principalId:'admin-1'}); });
  await page.goto('/desktop');
  await page.getByLabel('Administrator ID').fill('admin-1');
  await page.getByLabel('Credential').fill('not-stored');
  await page.getByRole('button', {name:'Sign in', exact:true}).last().click();
  await expect(page.getByRole('heading',{name:'Desktop'})).toBeVisible();
  expect(loginBody).toEqual({principalHint:'admin-1',credential:'not-stored'});
  const storage = await page.evaluate(() => ({...localStorage}));
  expect(storage['dgos.ui.principalHint']).toBe('admin-1');
  expect(JSON.stringify(storage)).not.toContain('not-stored');
});

test('session service failure shows retry and never opens first-time setup', async ({ page }) => {
  await page.unroute('**/api/v1/identity/admin/session');
  let attempts=0;
  await page.route('**/api/v1/identity/admin/session', route => {attempts+=1;return respond(route,{errorKey:'service_unavailable',message:'Session service unavailable',requestId:'req-session'},503)});
  await page.goto('/desktop');
  await expect(page.getByRole('alert')).toContainText('Session service unavailable · request req-session');
  await expect(page.getByRole('button',{name:'First-time setup'})).toHaveCount(0);
  await page.getByRole('button',{name:'Retry'}).click();
  await expect.poll(()=>attempts).toBe(2);
});

test('successful assistant navigation opens only an allowlisted target', async ({ page }) => {
  await page.route('**/api/v1/actions', route => respond(route,{items:[]}));
  await page.route('**/api/v1/audit/events**', route => respond(route,{items:[]}));
  await page.route('**/api/v1/action-runs/run-allowed', route => respond(route,{runId:'run-allowed',state:'succeeded',resultSummary:{navigation:{target:'provider.settings'}}}));
  await page.route('**/api/v1/provider/configs', route => respond(route,{items:[]}));
  await page.goto('/assistant');
  await page.evaluate(()=>localStorage.setItem('dgos.ui.runId','run-allowed'));
  await page.reload();
  await expect(page).toHaveURL(/\/providers$/);
  await page.evaluate(()=>localStorage.setItem('dgos.ui.runId','run-unknown'));
  await page.route('**/api/v1/action-runs/run-unknown', route => respond(route,{runId:'run-unknown',state:'succeeded',resultSummary:{navigation:{target:'https://example.invalid'}}}));
  await page.goto('/assistant');
  await expect(page.getByText('Run ID: run-unknown')).toBeVisible();
  await expect(page).toHaveURL(/\/assistant$/);
});
