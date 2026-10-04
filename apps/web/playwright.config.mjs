import { defineConfig } from '@playwright/test';

const host = process.env.WEB_HOST || '127.0.0.1';
const port = Number(process.env.WEB_PORT || 15133);
const baseURL = process.env.WEB_BASE_URL || `http://${host}:${port}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  use: { baseURL, headless: true },
  webServer: process.env.WEB_EXTERNAL === '1' ? undefined : {
    command: `HOST=${host} PORT=${port} pnpm start`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 15_000,
  },
  reporter: [['list']],
});
