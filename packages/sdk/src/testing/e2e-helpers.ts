// DGOS E2E Testing Helpers
// Utilities for end-to-end testing with Playwright

import type { Page, Browser } from '@playwright/test';

export interface E2EAppConfig {
  appId: string;
  name: string;
  version: string;
  installUrl?: string;
}

export class E2ETestHelper {
  constructor(
    private page: Page,
    private baseUrl: string = 'http://localhost:5173'
  ) {}

  /**
   * Navigate to DGOS home
   */
  async navigateHome(): Promise<void> {
    await this.page.goto(this.baseUrl);
  }

  /**
   * Login to DGOS
   */
  async login(username: string, password: string): Promise<void> {
    await this.page.goto(`${this.baseUrl}/login`);
    await this.page.fill('input[name="username"]', username);
    await this.page.fill('input[name="password"]', password);
    await this.page.click('button[type="submit"]');
    await this.page.waitForURL(`${this.baseUrl}/`, { timeout: 5000 });
  }

  /**
   * Install an app
   */
  async installApp(config: E2EAppConfig): Promise<void> {
    // Navigate to app catalog
    await this.page.goto(`${this.baseUrl}/apps`);

    // Search for app or install from URL
    if (config.installUrl) {
      await this.page.click('[data-testid="install-from-url"]');
      await this.page.fill('input[name="app-url"]', config.installUrl);
      await this.page.click('button[data-testid="install-button"]');
    } else {
      await this.page.fill('input[name="search"]', config.name);
      await this.page.click(`[data-testid="app-${config.appId}"] button`);
    }

    // Wait for installation to complete
    await this.page.waitForSelector(`[data-testid="app-installed-${config.appId}"]`, {
      timeout: 30000,
    });
  }

  /**
   * Uninstall an app
   */
  async uninstallApp(appId: string): Promise<void> {
    await this.page.goto(`${this.baseUrl}/apps/installed`);
    await this.page.click(`[data-testid="app-${appId}"] [data-testid="uninstall-button"]`);
    await this.page.click('[data-testid="confirm-uninstall"]');
    await this.page.waitForSelector(`[data-testid="app-${appId}"]`, {
      state: 'detached',
      timeout: 10000,
    });
  }

  /**
   * Launch an app
   */
  async launchApp(appId: string): Promise<void> {
    await this.page.click(`[data-testid="launch-app-${appId}"]`);
    await this.page.waitForSelector(`[data-testid="app-window-${appId}"]`, {
      timeout: 10000,
    });
  }

  /**
   * Grant a permission
   */
  async grantPermission(capability: string): Promise<void> {
    // Wait for permission dialog
    await this.page.waitForSelector('[data-testid="permission-dialog"]');

    // Check that the correct capability is being requested
    const text = await this.page.textContent('[data-testid="permission-capability"]');
    if (!text?.includes(capability)) {
      throw new Error(`Expected permission request for ${capability}, got ${text}`);
    }

    // Grant the permission
    await this.page.click('[data-testid="grant-permission"]');
    await this.page.waitForSelector('[data-testid="permission-dialog"]', {
      state: 'detached',
    });
  }

  /**
   * Deny a permission
   */
  async denyPermission(): Promise<void> {
    await this.page.waitForSelector('[data-testid="permission-dialog"]');
    await this.page.click('[data-testid="deny-permission"]');
    await this.page.waitForSelector('[data-testid="permission-dialog"]', {
      state: 'detached',
    });
  }

  /**
   * Take a screenshot
   */
  async screenshot(name: string, options?: {
    fullPage?: boolean;
    clip?: { x: number; y: number; width: number; height: number };
  }): Promise<Buffer> {
    return await this.page.screenshot({
      path: `screenshots/${name}.png`,
      fullPage: options?.fullPage,
      clip: options?.clip,
    });
  }

  /**
   * Wait for app to be ready
   */
  async waitForAppReady(appId: string, timeout: number = 10000): Promise<void> {
    await this.page.waitForSelector(
      `[data-testid="app-window-${appId}"][data-state="ready"]`,
      { timeout }
    );
  }

  /**
   * Simulate user interaction
   */
  async interact(selector: string, action: 'click' | 'fill' | 'select', value?: string): Promise<void> {
    switch (action) {
      case 'click':
        await this.page.click(selector);
        break;
      case 'fill':
        if (value === undefined) {
          throw new Error('Value required for fill action');
        }
        await this.page.fill(selector, value);
        break;
      case 'select':
        if (value === undefined) {
          throw new Error('Value required for select action');
        }
        await this.page.selectOption(selector, value);
        break;
    }
  }

  /**
   * Check if element exists
   */
  async elementExists(selector: string): Promise<boolean> {
    return (await this.page.$(selector)) !== null;
  }

  /**
   * Get element text
   */
  async getText(selector: string): Promise<string | null> {
    return await this.page.textContent(selector);
  }

  /**
   * Wait for navigation
   */
  async waitForNavigation(url?: string): Promise<void> {
    if (url) {
      await this.page.waitForURL(url);
    } else {
      await this.page.waitForLoadState('networkidle');
    }
  }

  /**
   * Simulate keyboard input
   */
  async keyboard(key: string): Promise<void> {
    await this.page.keyboard.press(key);
  }

  /**
   * Test keyboard navigation
   */
  async testKeyboardNavigation(selectors: string[]): Promise<boolean> {
    for (const selector of selectors) {
      await this.page.focus(selector);
      const focused = await this.page.evaluate(
        (sel) => document.querySelector(sel) === document.activeElement,
        selector
      );
      if (!focused) {
        return false;
      }
      await this.page.keyboard.press('Tab');
    }
    return true;
  }

  /**
   * Check accessibility
   */
  async checkAccessibility(): Promise<{
    violations: Array<{ id: string; description: string; nodes: number }>;
  }> {
    // This would integrate with axe-core or similar
    // For now, return a placeholder
    return { violations: [] };
  }

  /**
   * Get console logs
   */
  getConsoleLogs(): Array<{ type: string; text: string }> {
    const logs: Array<{ type: string; text: string }> = [];
    this.page.on('console', (msg) => {
      logs.push({ type: msg.type(), text: msg.text() });
    });
    return logs;
  }

  /**
   * Wait for a specific console message
   */
  async waitForConsoleMessage(
    predicate: (msg: { type: string; text: string }) => boolean,
    timeout: number = 5000
  ): Promise<void> {
    await this.page.waitForEvent('console', {
      predicate: (msg) => predicate({ type: msg.type(), text: msg.text() }),
      timeout,
    });
  }
}

/**
 * Create E2E test helper
 */
export function createE2EHelper(page: Page, baseUrl?: string): E2ETestHelper {
  return new E2ETestHelper(page, baseUrl);
}
