import { test, expect } from '@playwright/test';

test.skip(!process.env.REAL_ADMIN_ID || !process.env.REAL_ADMIN_CREDENTIAL, 'Set real integration administrator credentials');

test('developer center UI loads and displays catalog', async ({ page }) => {
  await page.goto('/developer');
  await page.getByLabel('Administrator ID').fill(process.env.REAL_ADMIN_ID);
  await page.getByLabel('Credential').fill(process.env.REAL_ADMIN_CREDENTIAL);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();

  await expect(page.getByRole('heading', { name: 'Developer center', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Submit signed package' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'App catalog' })).toBeVisible();

  // Verify catalog loads
  const catalog = await page.evaluate(async () => {
    const response = await fetch('/api/v1/apps');
    return { status: response.status, body: await response.json() };
  });
  expect(catalog.status).toBe(200);
  expect(Array.isArray(catalog.body.items)).toBe(true);
});

test('developer center filter functionality', async ({ page }) => {
  await page.goto('/developer');
  await page.getByLabel('Administrator ID').fill(process.env.REAL_ADMIN_ID);
  await page.getByLabel('Credential').fill(process.env.REAL_ADMIN_CREDENTIAL);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();

  // Test filter dropdown
  const filterSelect = page.locator('select').filter({ hasText: /All|Pending Review|Approved|Rejected/ });
  await expect(filterSelect).toBeVisible();

  // Filter by Pending Review
  await filterSelect.selectOption('pending');
  await page.waitForTimeout(500);

  // Filter by Approved
  await filterSelect.selectOption('approved');
  await page.waitForTimeout(500);

  // Filter by All
  await filterSelect.selectOption('all');
  await page.waitForTimeout(500);
});

test('app detail view displays complete metadata', async ({ page }) => {
  await page.goto('/developer');
  await page.getByLabel('Administrator ID').fill(process.env.REAL_ADMIN_ID);
  await page.getByLabel('Credential').fill(process.env.REAL_ADMIN_CREDENTIAL);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();

  // Wait for apps to load
  await expect(page.locator('.record-list li').first()).toBeVisible({ timeout: 10000 });

  // Click Details button on first app
  await page.locator('.record-list li').first().getByRole('button', { name: 'Details' }).click();

  // Verify detail modal appears
  const modal = page.locator('[role="dialog"]');
  await expect(modal).toBeVisible();

  // Check for key metadata fields
  await expect(modal.getByText('App ID')).toBeVisible();
  await expect(modal.getByText('Version')).toBeVisible();
  await expect(modal.getByText('Channel')).toBeVisible();
  await expect(modal.getByText('Status')).toBeVisible();
  await expect(modal.getByText('Source')).toBeVisible();
  await expect(modal.getByText('Requested trust')).toBeVisible();
  await expect(modal.getByText('Permissions')).toBeVisible();

  // Close modal
  await modal.getByRole('button', { name: 'Close' }).click();
  await expect(modal).not.toBeVisible();
});

test('installation records view shows deployment status', async ({ page }) => {
  await page.goto('/developer');
  await page.getByLabel('Administrator ID').fill(process.env.REAL_ADMIN_ID);
  await page.getByLabel('Credential').fill(process.env.REAL_ADMIN_CREDENTIAL);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();

  // Wait for apps to load
  await expect(page.locator('.record-list li').first()).toBeVisible({ timeout: 10000 });

  // Click Installation button on first app
  await page.locator('.record-list li').first().getByRole('button', { name: 'Installation' }).click();

  // Verify installation modal appears
  const modal = page.locator('[role="dialog"]').filter({ hasText: 'Installation:' });
  await expect(modal).toBeVisible();

  // Close modal
  await modal.getByRole('button', { name: 'Close' }).click();
  await expect(modal).not.toBeVisible();
});

test('package validation shows errors for invalid envelope', async ({ page }) => {
  await page.goto('/developer');
  await page.getByLabel('Administrator ID').fill(process.env.REAL_ADMIN_ID);
  await page.getByLabel('Credential').fill(process.env.REAL_ADMIN_CREDENTIAL);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();

  // Enter invalid JSON
  const textarea = page.getByLabel('Package envelope JSON');
  await textarea.fill('{ invalid json');

  // Try to preview
  await page.getByRole('button', { name: 'Preview' }).first().click();

  // Should show error
  await expect(page.locator('.dgos-alert')).toBeVisible();
});

test('review action flow with reason input', async ({ page }) => {
  test.skip(!process.env.TEST_REVIEW_APP, 'Set TEST_REVIEW_APP to an app ID for testing review flow');

  await page.goto('/developer');
  await page.getByLabel('Administrator ID').fill(process.env.REAL_ADMIN_ID);
  await page.getByLabel('Credential').fill(process.env.REAL_ADMIN_CREDENTIAL);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();

  // Filter to pending review
  await page.locator('select').filter({ hasText: /All|Pending Review/ }).selectOption('pending');

  // Find the test app
  const appRow = page.locator('.record-list li').filter({ hasText: process.env.TEST_REVIEW_APP });
  if (await appRow.count() === 0) {
    test.skip(true, `App ${process.env.TEST_REVIEW_APP} not found in pending review`);
  }

  // Click approve button
  await appRow.getByRole('button', { name: 'Approve' }).click();

  // Review modal should appear
  const modal = page.locator('[role="dialog"]').filter({ hasText: 'approve' });
  await expect(modal).toBeVisible();

  // Enter review reason
  await modal.getByLabel('Review reason').fill('E2E test approval');

  // Confirm
  const approveResponse = page.waitForResponse(response =>
    response.url().includes('/api/v1/apps/') &&
    response.url().includes('/approve') &&
    response.request().method() === 'POST'
  );

  await modal.getByRole('button', { name: 'Confirm' }).click();

  const response = await approveResponse;
  expect(response.status()).toBe(200);

  // Modal should close
  await expect(modal).not.toBeVisible();
});

test('catalog refresh updates app list', async ({ page }) => {
  await page.goto('/developer');
  await page.getByLabel('Administrator ID').fill(process.env.REAL_ADMIN_ID);
  await page.getByLabel('Credential').fill(process.env.REAL_ADMIN_CREDENTIAL);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();

  await expect(page.locator('.record-list li').first()).toBeVisible({ timeout: 10000 });

  // Click refresh
  const refreshButton = page.getByRole('button', { name: 'Refresh' }).last();
  await refreshButton.click();

  // Wait for reload
  await page.waitForTimeout(1000);

  // Catalog should still be visible
  await expect(page.locator('.record-list')).toBeVisible();
});

test('test-install action is available for developers', async ({ page }) => {
  await page.goto('/developer');
  await page.getByLabel('Administrator ID').fill(process.env.REAL_ADMIN_ID);
  await page.getByLabel('Credential').fill(process.env.REAL_ADMIN_CREDENTIAL);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();

  await expect(page.locator('.record-list li').first()).toBeVisible({ timeout: 10000 });

  // Verify test-install button exists
  const testInstallButton = page.locator('.record-list li').first().getByRole('button', { name: 'Test install' });
  await expect(testInstallButton).toBeVisible();
});

test('keyboard navigation closes modals with Escape', async ({ page }) => {
  await page.goto('/developer');
  await page.getByLabel('Administrator ID').fill(process.env.REAL_ADMIN_ID);
  await page.getByLabel('Credential').fill(process.env.REAL_ADMIN_CREDENTIAL);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();

  await expect(page.locator('.record-list li').first()).toBeVisible({ timeout: 10000 });

  // Open details modal
  await page.locator('.record-list li').first().getByRole('button', { name: 'Details' }).click();
  const modal = page.locator('[role="dialog"]');
  await expect(modal).toBeVisible();

  // Press Escape
  await page.keyboard.press('Escape');

  // Modal should close
  await expect(modal).not.toBeVisible();
});

test('all review actions available in detail view', async ({ page }) => {
  await page.goto('/developer');
  await page.getByLabel('Administrator ID').fill(process.env.REAL_ADMIN_ID);
  await page.getByLabel('Credential').fill(process.env.REAL_ADMIN_CREDENTIAL);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();

  await expect(page.locator('.record-list li').first()).toBeVisible({ timeout: 10000 });

  // Open details
  await page.locator('.record-list li').first().getByRole('button', { name: 'Details' }).click();
  const modal = page.locator('[role="dialog"]');
  await expect(modal).toBeVisible();

  // Verify all action buttons are present
  await expect(modal.getByRole('button', { name: 'Approve' })).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Reject' })).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Withdraw' })).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Test install' })).toBeVisible();

  await modal.getByRole('button', { name: 'Close' }).click();
});
