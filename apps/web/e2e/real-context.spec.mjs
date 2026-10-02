import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const enabled = process.env.REAL_MANAGEMENT_FIXTURE === '1';
test.skip(!enabled, 'Set REAL_MANAGEMENT_FIXTURE=1 for the isolated live management fixture');
const state = enabled ? JSON.parse(readFileSync(new URL('../../../data/v1-ui-management-fixture/state.json', import.meta.url))) : null;
const credentials = enabled ? JSON.parse(readFileSync(state.privateCredentialsFile)) : null;

const passed = name => console.log(JSON.stringify({ case_passed: name }));

async function read(page, path) {
  const result = await page.evaluate(async url => {
    const response = await fetch(url);
    return { status: response.status, body: await response.json() };
  }, path);
  expect(result.status, `${path}: ${result.body.errorKey || 'none'} requestId=${result.body.requestId || 'none'}`).toBe(200);
  return result.body;
}

async function patch(page, baseVersion, domain, value) {
  return page.evaluate(async input => {
    const response = await fetch('/api/v1/system/settings', {
      method: 'PATCH', headers: { 'content-type': 'application/json', 'x-dgos-csrf': 'web' },
      body: JSON.stringify({ requestId: crypto.randomUUID(), baseVersion: input.baseVersion, domain: input.domain, patch: input.value }),
    });
    return { status: response.status, body: await response.json() };
  }, { baseVersion, domain, value });
}

async function saveGui(page, domain, change) {
  await page.locator('select').filter({ has: page.getByRole('option', { name: 'appPermissions' }) }).selectOption(domain);
  const form = page.locator('form').filter({ has: page.locator(domain === 'appearance' ? 'select[name="appearanceMode"]' : domain === 'locale' ? 'select[name="uiLocale"]' : 'input[name="enabled"]') });
  await change(form);
  const response = page.waitForResponse(value => value.url().endsWith('/api/v1/system/settings') && value.request().method() === 'PATCH');
  await form.getByRole('button', { name: /Save changes|保存更改/ }).click();
  const saved = await response;
  const body = await saved.json();
  expect(saved.status(), `${domain}: ${body.errorKey || 'none'} requestId=${body.requestId || 'none'}`).toBe(200);
  expect(saved.request().postDataJSON()).toMatchObject({ domain });
  return body;
}

test('real System appearance, locale, grid, CAS and restoration use public API', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/settings');
  await page.getByLabel('Administrator ID').fill(state.principalId);
  await page.getByLabel('Credential').fill(credentials.adminCredential);
  const login = page.waitForResponse(value => value.url().endsWith('/api/v1/identity/admin/login') && value.request().method() === 'POST');
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  expect((await login).status()).toBe(200);
  await expect(page.locator('.dgos-top h1')).toBeVisible();
  const original = await read(page, '/api/v1/system/settings');
  const originalContext = await read(page, '/api/v1/system/context');
  const restore = async (domain, value) => {
    const latest = await read(page, '/api/v1/system/settings');
    const result = await patch(page, latest.settingsVersion, domain, value);
    expect(result.status, `restore ${domain}: ${result.body.errorKey || 'none'}`).toBe(200);
  };
  let touched = false;
  try {
    const mode = original.appearance.appearanceMode === 'dark' ? 'light' : 'dark';
    const scale = original.appearance.displayScale === 1.25 ? '1' : '1.25';
    touched = true;
    const appearance = await saveGui(page, 'appearance', async form => {
      await form.locator('select[name="appearanceMode"]').selectOption(mode);
      await form.locator('select[name="displayScale"]').selectOption(scale);
    });
    expect(appearance.appearance).toMatchObject({ appearanceMode: mode, displayScale: Number(scale) });
    const appearanceContext = await read(page, '/api/v1/system/context');
    expect(appearanceContext.appearance).toMatchObject({ appearanceMode: mode, displayScale: Number(scale) });
    expect(Number(appearanceContext.contextVersion)).toBeGreaterThan(Number(originalContext.contextVersion));
    passed('ui.system.appearance_context');

    const locale = original.locale.uiLocale === 'en-US' ? 'zh-CN' : 'en-US';
    const localized = await saveGui(page, 'locale', form => form.locator('select[name="uiLocale"]').selectOption(locale));
    expect(localized.locale.uiLocale).toBe(locale);
    const localeContext = await read(page, '/api/v1/system/context');
    expect(localeContext.locale).toMatchObject({ uiLocale: locale, regionFormat: original.locale.regionFormat, assistantLanguage: original.locale.assistantLanguage });
    expect(Number(localeContext.contextVersion)).toBeGreaterThan(Number(appearanceContext.contextVersion));
    passed('ui.system.locale_context');

    const grid = await saveGui(page, 'grid', form => form.locator('input[name="enabled"]').setChecked(!original.grid.enabled));
    expect(grid.grid.enabled).toBe(!original.grid.enabled);
    const gridContext = await read(page, '/api/v1/system/context');
    expect(gridContext.grid.enabled).toBe(!original.grid.enabled);
    expect(Number(gridContext.contextVersion)).toBeGreaterThan(Number(localeContext.contextVersion));
    passed('ui.system.grid_context');

    const stale = await patch(page, original.settingsVersion, 'grid', { enabled: original.grid.enabled });
    expect(stale).toMatchObject({ status: 409, body: { errorKey: 'version_conflict' } });
    expect((await read(page, '/api/v1/system/settings')).grid.enabled).toBe(!original.grid.enabled);
    passed('ui.system.cas_conflict');
  } finally {
    if (touched) {
      await restore('appearance', original.appearance);
      await restore('locale', { uiLocale: original.locale.uiLocale, regionFormat: original.locale.regionFormat, assistantLanguage: original.locale.assistantLanguage, projectContentLanguage: original.locale.projectContentLanguage });
      await restore('grid', original.grid);
      const final = await read(page, '/api/v1/system/settings');
      expect(final.appearance).toEqual(original.appearance);
      expect(final.locale).toEqual(original.locale);
      expect(final.grid).toEqual(original.grid);
      const context = await read(page, '/api/v1/system/context');
      expect(context.appearance).toEqual(originalContext.appearance);
      expect(context.locale).toEqual(originalContext.locale);
      expect(context.grid).toEqual(originalContext.grid);
      passed('ui.system.restore');
    }
  }
});
