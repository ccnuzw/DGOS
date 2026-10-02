import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';

export async function browserHealthProbe({ app, packagePath }) {
  const entry = app.entrypoints?.web;
  if (!entry) return false;
  const server = createServer(async (request, response) => {
    const path = new URL(request.url, 'http://127.0.0.1').pathname.slice(1);
    if (!['index.html', 'workbench.css', 'workbench.js', 'icon.svg'].includes(path)) { response.statusCode = 404; response.end(); return; }
    response.setHeader('content-type', path.endsWith('.html') ? 'text/html' : path.endsWith('.css') ? 'text/css' : path.endsWith('.js') ? 'text/javascript' : 'image/svg+xml');
    if (path.endsWith('.html')) response.setHeader('content-security-policy', "sandbox allow-scripts; default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'");
    try { const data = await readFile(join(packagePath, path)); response.end(path.endsWith('.html') ? data.toString().replaceAll('__DGOS_LAUNCH_TICKET__', 'probe') : data); } catch { response.statusCode = 404; response.end(); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.setContent(`<iframe id="app" sandbox="allow-scripts" src="http://127.0.0.1:${server.address().port}/${entry}"></iframe>`);
    const frame = page.frameLocator('#app'); await frame.locator('#status').waitFor({ timeout: 5000 });
    await page.locator('#app').evaluate((iframe) => iframe.contentWindow.postMessage({ type: 'dgos.host.hello', instanceId: 'health-probe', bridgeVersion: 1 }, '*'));
    await frame.locator('#status').getByText('Ready').waitFor({ timeout: 5000 });
    return true;
  } catch { return false; }
  finally { await browser?.close(); await new Promise((resolve) => server.close(resolve)); }
}
