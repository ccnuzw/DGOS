// DGOS Visual Regression Test
// Visual regression tests for UI components

import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
  });

  test('home page screenshot', async ({ page }) => {
    await expect(page).toHaveScreenshot('home-page.png');
  });

  test('app catalog screenshot', async ({ page }) => {
    await page.click('[data-testid="app-catalog"]');
    await page.waitForSelector('[data-testid="app-list"]');
    await expect(page).toHaveScreenshot('app-catalog.png');
  });

  test('settings page screenshot', async ({ page }) => {
    await page.click('[data-testid="settings"]');
    await page.waitForSelector('[data-testid="settings-panel"]');
    await expect(page).toHaveScreenshot('settings-page.png');
  });

  test('dark mode screenshot', async ({ page }) => {
    // Toggle dark mode
    await page.click('[data-testid="theme-toggle"]');
    await page.waitForTimeout(500); // Wait for theme transition
    await expect(page).toHaveScreenshot('home-page-dark.png');
  });

  test('responsive mobile view', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page).toHaveScreenshot('home-page-mobile.png');
  });

  test('app window screenshot', async ({ page }) => {
    await page.click('[data-testid="launch-app-test.weather"]');
    await page.waitForSelector('[data-testid="app-window-test.weather"]');

    const appWindow = page.locator('[data-testid="app-window-test.weather"]');
    await expect(appWindow).toHaveScreenshot('weather-app-window.png');
  });

  test('permission dialog screenshot', async ({ page }) => {
    await page.click('[data-testid="request-permission"]');
    await page.waitForSelector('[data-testid="permission-dialog"]');

    const dialog = page.locator('[data-testid="permission-dialog"]');
    await expect(dialog).toHaveScreenshot('permission-dialog.png');
  });

  test('notification screenshot', async ({ page }) => {
    await page.click('[data-testid="show-notification"]');
    await page.waitForSelector('[data-testid="notification"]');

    const notification = page.locator('[data-testid="notification"]');
    await expect(notification).toHaveScreenshot('notification.png');
  });
});
