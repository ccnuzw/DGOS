// DGOS E2E App Catalog Test
// End-to-end test for app installation and management

import { test, expect } from '@playwright/test';
import { createE2EHelper } from '../../packages/sdk/src/testing/e2e-helpers.ts';

test.describe('App Catalog E2E', () => {
  test('install and launch app', async ({ page }) => {
    const helper = createE2EHelper(page);

    // Navigate to DGOS
    await helper.navigateHome();

    // Install a test app
    await helper.installApp({
      appId: 'test.weather',
      name: 'Weather App',
      version: '1.0.0',
    });

    // Verify app is installed
    const installed = await helper.elementExists('[data-testid="app-test.weather"]');
    expect(installed).toBe(true);

    // Launch the app
    await helper.launchApp('test.weather');

    // Wait for app to be ready
    await helper.waitForAppReady('test.weather');

    // Take screenshot
    await helper.screenshot('weather-app-launched');

    // Verify app window is visible
    const windowVisible = await helper.elementExists('[data-testid="app-window-test.weather"]');
    expect(windowVisible).toBe(true);
  });

  test('permission flow', async ({ page }) => {
    const helper = createE2EHelper(page);

    await helper.navigateHome();
    await helper.launchApp('test.weather');

    // App should request location permission
    // Grant it
    await helper.grantPermission('geolocation.read');

    // Verify permission was granted
    await helper.waitForAppReady('test.weather');

    // Check that app can now access location
    const locationData = await helper.getText('[data-testid="location-display"]');
    expect(locationData).toBeTruthy();
  });

  test('uninstall app', async ({ page }) => {
    const helper = createE2EHelper(page);

    await helper.navigateHome();

    // First install the app
    await helper.installApp({
      appId: 'test.notes',
      name: 'Notes App',
      version: '1.0.0',
    });

    // Then uninstall it
    await helper.uninstallApp('test.notes');

    // Verify app is no longer installed
    const stillInstalled = await helper.elementExists('[data-testid="app-test.notes"]');
    expect(stillInstalled).toBe(false);
  });

  test('keyboard navigation', async ({ page }) => {
    const helper = createE2EHelper(page);

    await helper.navigateHome();

    // Test keyboard navigation through app catalog
    const canNavigate = await helper.testKeyboardNavigation([
      '[data-testid="search-input"]',
      '[data-testid="app-catalog-item-0"]',
      '[data-testid="app-catalog-item-1"]',
    ]);

    expect(canNavigate).toBe(true);

    // Test Enter key to launch app
    await page.focus('[data-testid="launch-app-test.weather"]');
    await helper.keyboard('Enter');

    await helper.waitForAppReady('test.weather');
  });

  test('app state persistence', async ({ page }) => {
    const helper = createE2EHelper(page);

    await helper.navigateHome();
    await helper.launchApp('test.notes');
    await helper.waitForAppReady('test.notes');

    // Create a note
    await helper.interact('[data-testid="note-input"]', 'fill', 'Test note content');
    await helper.interact('[data-testid="save-note"]', 'click');

    // Close the app
    await helper.interact('[data-testid="close-app-test.notes"]', 'click');

    // Re-launch the app
    await helper.launchApp('test.notes');
    await helper.waitForAppReady('test.notes');

    // Verify note was saved
    const noteContent = await helper.getText('[data-testid="note-content"]');
    expect(noteContent).toBe('Test note content');
  });
});
