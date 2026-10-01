import { test, expect } from '@playwright/test';

test.skip(!process.env.API_BASE_URL, 'Set API_BASE_URL to a running real API harness');

test('real API workbench submits and resumes a streamed task', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'First-time setup' }).click();
  await page.getByLabel('Display name').fill('Web Real Admin');
  await page.getByLabel('Credential').fill('fixture-owner');
  await page.getByRole('button', { name: 'Create admin session' }).click();
  await expect(page.getByRole('heading', { name: 'AI Workbench' })).toBeVisible();
  await page.getByText('Create provider configuration').click();
  await page.getByLabel('Base URL').fill(process.env.FIXTURE_BASE_URL);
  await page.getByLabel('Credential').fill('dgos-fixture-token');
  await page.getByRole('button', { name: 'Save configuration' }).click();
  await page.getByRole('button', { name: 'Validate and refresh catalog' }).click();
  await expect(page.getByText('Fixture Text')).toBeVisible();
  await page.getByRole('button', { name: 'Enable' }).click();
  await expect(page.getByRole('button', { name: 'Enabled' })).toBeVisible();
  await page.getByLabel('Prompt').fill('hello from browser');
  await page.getByRole('button', { name: 'Run task' }).click();
  await expect(page.locator('.result pre')).toContainText('hello world', { timeout: 10000 });
  await expect(page.locator('.pill.succeeded')).toBeVisible();
  await page.getByRole('button', { name: 'Re-query / resume' }).click();
  await expect(page.locator('.result pre')).toContainText('hello world');
});
