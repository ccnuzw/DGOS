import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './e2e', timeout: 15000, use: { baseURL: process.env.WEB_BASE_URL || 'http://127.0.0.1:4173', headless: true }, webServer: { command: 'pnpm start', url: process.env.WEB_BASE_URL || 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI, timeout: 10_000 }, reporter: [['list']] });
