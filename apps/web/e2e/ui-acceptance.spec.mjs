import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const evidence = resolve('evidence/ui-r5');
const respond = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
const settings = { settingsVersion: '7', appearance: { appearanceMode: 'light', displayScale: 1 }, locale: { uiLocale: 'en-US', effectiveLocale: 'en-US', regionFormat: 'zh-CN', assistantLanguage: 'en-US', projectContentLanguage: 'en-US' }, network: { proxyMode: 'off', effectiveRoute: 'direct', affectedServices: [], restartRequired: false }, grid: { enabled: false }, privacy: { telemetry: false }, appPermissions: [] };

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/identity/admin/session', route => respond(route, { sessionId: 'session-ui', principalId: 'fixture-admin' }));
  await page.route('**/api/v1/system/settings', route => respond(route, settings));
  await page.route('**/api/v1/system/context', route => respond(route, { contextVersion: '7', locale: settings.locale }));
});

test('UI-AC001/006 theme, language and scale controls stay visible without overlap', async ({ page }) => {
  await mkdir(evidence, { recursive: true });
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
  await page.evaluate(() => { localStorage.setItem('dgos.ui.locale', 'en'); localStorage.setItem('dgos.ui.theme', 'light'); });
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 800 });
    for (const theme of ['light', 'dark']) for (const language of ['en', 'zh']) for (const scale of [75, 100, 125, 150, 175]) {
      await page.goto('/settings');
      await page.locator('.top-actions select').nth(0).selectOption(theme);
      await page.locator('.top-actions select').nth(1).selectOption(language);
      await page.locator('.top-actions').getByLabel(language === 'zh' ? '显示倍率' : 'Display scale').selectOption(String(scale));
      const save = page.getByRole('button', { name: language === 'zh' ? '保存更改' : 'Save changes' });
      await expect(save).toBeVisible();
      const layout = await page.evaluate(() => {
        const selectors = ['.dgos-top', '.dgos-content', '.dgos-content form', '.dgos-content form button', '.dgos-side nav'];
        const boxes = selectors.map(selector => { const element = document.querySelector(selector); const box = element?.getBoundingClientRect(); return { selector, left: box?.left, right: box?.right, top: box?.top, bottom: box?.bottom }; });
        return { width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, boxes };
      });
      expect(layout.scrollWidth, JSON.stringify(layout)).toBeLessThanOrEqual(layout.width + 2);
      for (const box of layout.boxes.slice(1, 4)) {
        expect(box.left, JSON.stringify(layout)).toBeGreaterThanOrEqual(-2);
        expect(box.right, JSON.stringify(layout)).toBeLessThanOrEqual(layout.width + 2);
      }
      await page.locator('.dgos-shell').screenshot({ path: resolve(evidence, `settings-${width}-${theme}-${language}-${scale}.png`) });
    }
  }
});

test('UI-AC003 command dialog traps keyboard focus and restores it on Escape', async ({ page }) => {
  await page.goto('/desktop');
  await expect(page.locator('.dgos-top h1')).toBeVisible();
  await page.getByRole('button', { name: /command palette|命令面板/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button').first()).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button').last()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.command-button')).toBeFocused();
});
