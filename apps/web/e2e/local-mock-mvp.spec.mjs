import { test, expect } from '@playwright/test';

const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/identity/admin/session', route => json(route, { sessionId: 'local-session', principalId: 'local-owner' }));
  await page.route('**/api/v1/system/context', route => json(route, { contextVersion: 'local-1', locale: { uiLocale: 'en-US', regionFormat: 'en-US' } }));
  await page.route('**/api/v1/provider/configs', route => json(route, { items: [{ id: 'mock-provider', displayName: 'Mock Provider', status: 'ready' }] }));
  await page.route('**/api/v1/provider/configs/mock-provider/models', route => json(route, { items: [{ modelId: 'mock-text-model', displayName: 'Mock Text', intent: 'text.chat' }] }));
});

test('local MVP workspace exposes the core navigation surface', async ({ page }) => {
  await page.goto('/desktop?mock=1');
  await expect(page.getByRole('heading', { name: 'Workspace', level: 2 })).toBeVisible({ timeout: 10000 });
  for (const label of ['Settings', 'Providers', 'Models', 'Skills', 'MCP']) await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  const layout = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width + 2);
});

test('local mock task completes through submit, streamed events and artifact reference', async ({ page }) => {
  await page.goto('/ai-tasks?mock=1');
  await page.getByLabel('Prompt').fill('local MVP hello');
  await page.getByRole('button', { name: 'Submit task' }).click();
  await expect(page.getByText(/Task ID: mock-task-/)).toBeVisible();
  await expect(page.locator('.task-output')).toContainText('Mock response for: local MVP hello', { timeout: 10000 });
  await expect(page.locator('[role="status"]').filter({ hasText: 'succeeded' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/Events:/)).toContainText('Events:');
});

test('local mock task cancellation is terminal and does not submit twice', async ({ page }) => {
  let submits = 0;
  await page.route('**/api/v1/ai-tasks', route => { submits += 1; return route.continue(); });
  await page.goto('/ai-tasks?mock=1');
  await page.getByLabel('Prompt').fill('cancel this local task');
  await page.getByRole('button', { name: 'Submit task' }).click();
  await expect(page.getByText(/Task ID: mock-task-/)).toBeVisible();
  await page.getByRole('button', { name: 'Cancel task' }).click();
  await expect(page.locator('[role="status"]').filter({ hasText: 'cancelled' })).toBeVisible({ timeout: 10000 });
  expect(submits).toBe(0);
});

test('local settings mock preserves version conflict without applying stale write', async ({ page }) => {
  let patch;
  await page.route('**/api/v1/system/settings', route => {
    if (route.request().method() === 'PATCH') { patch = route.request().postDataJSON(); return json(route, { errorKey: 'version_conflict', message: 'Version conflict', requestId: 'local-req-1' }, 409); }
    return json(route, { settingsVersion: 'local-1', appearance: { appearanceMode: 'light', displayScale: 1 }, locale: { uiLocale: 'en-US' }, network: { proxyMode: 'off' }, grid: { enabled: false } });
  });
  await page.route('**/api/v1/system/context', route => json(route, { contextVersion: 'local-1', locale: { uiLocale: 'en-US' } }));
  await page.goto('/settings?mock=1');
  await page.locator('form select[name="appearanceMode"]').selectOption('dark');
  await page.locator('form').filter({ has: page.locator('select[name="appearanceMode"]') }).getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('alert')).toContainText('Version conflict');
  expect(patch).toMatchObject({ baseVersion: 'local-1', domain: 'appearance', patch: { appearanceMode: 'dark' } });
});
