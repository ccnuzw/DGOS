import { test, expect } from '@playwright/test';

const respond = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/identity/admin/session', route => respond(route, { sessionId: 'session-1', principalId: 'owner' }));
});

test('system info page displays system information', async ({ page }) => {
  await page.route('**/api/v1/system/info', route => respond(route, {
    system: {
      version: 'V1',
      apiVersion: '1.0.0',
      nodeVersion: 'v22.0.0',
      platform: 'darwin arm64',
      uptime: 3600,
    },
    resources: {
      cpuUsage: 45.5,
      cpuCount: 8,
      memoryUsed: 8589934592,
      memoryTotal: 17179869184,
      heapUsed: 104857600,
      heapTotal: 209715200,
    },
    services: {
      api: { status: 'active' },
      worker: { status: 'active' },
      database: { status: 'active', connections: 5 },
      redis: { status: 'active' },
    },
    network: {
      proxyMode: 'system',
      effectiveRoute: 'direct',
      restartRequired: false,
      affectedServices: [],
    },
    apps: {
      installedCount: 3,
      runningCount: 1,
    },
    sessions: {
      activeCount: 2,
      totalUsers: 1,
    },
    storage: {
      databaseType: 'PostgreSQL',
      databaseSize: 1048576000,
      totalRecords: 1500,
      auditEvents: 500,
    },
  }));

  await page.goto('/system');

  // Check page title
  await expect(page.getByRole('heading', { name: 'System Information' })).toBeVisible();

  // Check system information is displayed
  await expect(page.getByText('DGOS Version')).toBeVisible();
  await expect(page.getByText('V1')).toBeVisible();
  await expect(page.getByText('API Version')).toBeVisible();
  await expect(page.getByText('1.0.0')).toBeVisible();

  // Check resources are displayed
  await expect(page.getByText('CPU Usage')).toBeVisible();
  await expect(page.getByText(/45\.5%/)).toBeVisible();
  await expect(page.getByText('Memory Used')).toBeVisible();

  // Check services are displayed
  await expect(page.getByRole('heading', { name: 'Services', exact: true })).toBeVisible();
  await expect(page.getByText('API Server', { exact: true })).toBeVisible();
  await expect(page.getByText('Database', { exact: true })).toBeVisible();

  // Check network information
  await expect(page.getByRole('heading', { name: 'Network' })).toBeVisible();
  await expect(page.getByText('Proxy Mode')).toBeVisible();
  await expect(page.getByText('system', { exact: true })).toBeVisible();

  // Check applications section
  await expect(page.getByRole('heading', { name: 'Applications' })).toBeVisible();
  await expect(page.getByText('Installed Apps')).toBeVisible();
  await expect(page.getByText('3')).toBeVisible();

  // Check storage section
  await expect(page.getByRole('heading', { name: 'Storage & Database' })).toBeVisible();
  await expect(page.getByText('PostgreSQL')).toBeVisible();
});

test('system info auto-refresh can be toggled', async ({ page }) => {
  let requestCount = 0;
  await page.route('**/api/v1/system/info', route => {
    requestCount++;
    return respond(route, {
      system: { version: 'V1', apiVersion: '1.0.0', nodeVersion: 'v22.0.0', platform: 'darwin arm64', uptime: 3600 },
      resources: { cpuUsage: 45, cpuCount: 8, memoryUsed: 8589934592, memoryTotal: 17179869184, heapUsed: 104857600, heapTotal: 209715200 },
      services: { api: { status: 'active' }, worker: { status: 'active' }, database: { status: 'active' }, redis: { status: 'active' } },
      network: { proxyMode: 'system', effectiveRoute: 'direct', restartRequired: false, affectedServices: [] },
      apps: { installedCount: 0, runningCount: 0 },
      sessions: { activeCount: 0, totalUsers: 0 },
      storage: { databaseType: 'In-Memory' },
    });
  });

  await page.goto('/system');
  await expect(page.getByRole('heading', { name: 'System Information' })).toBeVisible();

  const initialCount = requestCount;

  // Disable auto-refresh
  await page.getByLabel('Auto-refresh').uncheck();

  // Wait a bit to ensure no more requests happen
  await page.waitForTimeout(7000);

  // Request count should not increase significantly (maybe 1-2 due to initial load timing)
  const countAfterDisable = requestCount;
  expect(countAfterDisable).toBeLessThanOrEqual(initialCount + 2);

  // Re-enable auto-refresh
  await page.getByLabel('Auto-refresh').check();

  // Wait for at least two auto-refresh cycles (5s interval, so wait 11s)
  await page.waitForTimeout(11000);

  // Request count should have increased by at least 1 (we should get at least 2 refreshes)
  expect(requestCount).toBeGreaterThanOrEqual(countAfterDisable + 2);
});

test('system info refresh button works', async ({ page }) => {
  let requestCount = 0;
  await page.route('**/api/v1/system/info', route => {
    requestCount++;
    return respond(route, {
      system: { version: 'V1', apiVersion: '1.0.0', nodeVersion: 'v22.0.0', platform: 'darwin arm64', uptime: 3600 },
      resources: { cpuUsage: 45, cpuCount: 8, memoryUsed: 8589934592, memoryTotal: 17179869184, heapUsed: 104857600, heapTotal: 209715200 },
      services: { api: { status: 'active' }, worker: { status: 'active' }, database: { status: 'active' }, redis: { status: 'active' } },
      network: { proxyMode: 'system', effectiveRoute: 'direct', restartRequired: false, affectedServices: [] },
      apps: { installedCount: 0, runningCount: 0 },
      sessions: { activeCount: 0, totalUsers: 0 },
      storage: { databaseType: 'In-Memory' },
    });
  });

  await page.goto('/system');

  // Disable auto-refresh to isolate manual refresh
  await page.getByLabel('Auto-refresh').uncheck();

  const beforeClick = requestCount;

  // Click refresh button
  await page.getByRole('button', { name: 'Refresh' }).click();

  // Wait a moment for the request
  await page.waitForTimeout(500);

  // Request count should have increased
  expect(requestCount).toBeGreaterThan(beforeClick);
});
