import { test, expect } from '@playwright/test';

test('web workbench covers bootstrap, provider catalog, policy, streamed task, resume and cancel', async ({ page }) => {
  let taskStatus = 'queued';
  await page.route('**/api/v1/identity/admin/session', async (route) => route.fulfill({ status: 401, body: JSON.stringify({ message: 'Authentication required' }), contentType: 'application/json' }));
  await page.route('**/api/v1/identity/admin/bootstrap', async (route) => route.fulfill({ status: 201, body: JSON.stringify({ sessionId: 'fixture-session', principalId: 'owner' }), headers: { 'set-cookie': 'dgos_session=fixture-session' }, contentType: 'application/json' }));
  await page.route((url) => url.pathname === '/api/v1/provider/configs', async (route) => route.fulfill({ status: 200, body: JSON.stringify({ items: [{ id: 'config-1', displayName: 'Fixture', status: 'ready', baseUrl: 'https://provider.invalid/v1' }] }), contentType: 'application/json' }));
  await page.route((url) => url.pathname.includes('/actions') || url.pathname.includes('/system/settings') || url.pathname.includes('/system/context') || url.pathname.includes('/audit/events'), async (route) => route.fulfill({ status: 200, body: JSON.stringify({ items: [] }), contentType: 'application/json' }));
  await page.route((url) => url.pathname.includes('/models') || url.pathname.includes('/model-policies'), async (route) => route.fulfill({ status: 200, body: JSON.stringify({ items: [{ modelId: 'fixture-text-model', displayName: 'Fixture Text', streaming: true, enabled: true, version: '1' }] }), contentType: 'application/json' }));
  await page.route('**/api/v1/ai-tasks', async (route) => { taskStatus = 'running'; await route.fulfill({ status: 202, body: JSON.stringify({ taskId: 'task-1', status: taskStatus }), contentType: 'application/json' }); });
  await page.route('**/api/v1/ai-tasks/task-1/events**', async (route) => { taskStatus = 'succeeded'; return route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'id: 1\nevent: text.delta\ndata: {"sequence":1,"type":"text.delta","delta":"hello "}\n\nid: 2\nevent: text.delta\ndata: {"sequence":2,"type":"text.delta","delta":"world"}\n\nid: 3\nevent: task.completed\ndata: {"sequence":3,"type":"task.completed"}\n\n' }); });
  await page.route('**/api/v1/ai-tasks/task-1', async (route) => { if (route.request().method() === 'DELETE') { taskStatus = 'cancelled'; return route.fulfill({ status: 200, body: JSON.stringify({ taskId: 'task-1', status: taskStatus }), contentType: 'application/json' }); } return route.fulfill({ status: 200, body: JSON.stringify({ taskId: 'task-1', status: taskStatus, text: 'hello world', artifactIds: ['artifact-1'] }), contentType: 'application/json' }); });
  await page.goto('/');
  await page.getByRole('button', { name: 'First-time setup' }).click();
  await page.getByLabel('Display name').fill('E2E Admin'); await page.getByLabel('Credential').fill('fixture-secret'); await page.getByRole('button', { name: 'Create admin session' }).click();
  await expect(page.getByRole('heading', { name: 'AI Workbench' })).toBeVisible(); await expect(page.locator('li').filter({ hasText: 'Fixture Text' })).toBeVisible();
  await page.getByLabel('Prompt').fill('Say hello'); await page.getByRole('button', { name: 'Run task' }).click();
  await expect(page.locator('.result pre')).toContainText('hello world'); await expect(page.locator('.pill.succeeded')).toBeVisible();
  await page.getByRole('button', { name: 'Re-query / resume' }).click(); await expect(page.locator('.result pre')).toContainText('hello world');
});
