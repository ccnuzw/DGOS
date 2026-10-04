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
  const responsePromise = page.waitForResponse(value => value.url().endsWith('/api/v1/identity/admin/login') && value.request().method() === 'POST');
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  await expect.poll(async () => page.evaluate(async () => (await fetch('/api/v1/identity/admin/session')).status), { timeout: 10000 }).toBe(200);
  await page.reload();
  await expect.poll(async () => page.evaluate(async () => (await fetch('/api/v1/identity/admin/session')).status), { timeout: 10000 }).toBe(200);
}

test('FR-001 live settings remains usable at desktop and mobile widths', async ({ page }) => {
  await signIn(page, '/settings');
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
    await expect(page.getByText(/Settings version:/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible();
    const layout = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    expect(layout.scrollWidth, JSON.stringify(layout)).toBeLessThanOrEqual(layout.width + 2);
  }
});

test('FR-001 live workspace exposes core application tiles', async ({ page }) => {
  await signIn(page, '/desktop');
  await expect(page.getByRole('heading', { name: 'Workspace', level: 2 })).toBeVisible();
  for (const label of ['Settings', 'Providers', 'Models', 'Skills', 'MCP']) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }
});
