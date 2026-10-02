import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { chromium } from '@playwright/test';
import { verifyPackage } from '../../src/apps/package-service.mjs';

const base = new URL('../../.herdr/state/package-fixture-r9/', import.meta.url);
const envelope = JSON.parse(await readFile(process.env.DGOS_BUNDLE_ENVELOPE ?? new URL('ai-workbench-envelope.json', base), 'utf8'));
const roots = JSON.parse(await readFile(process.env.DGOS_BUNDLE_TRUST_ROOTS ?? new URL('trust-roots.json', base), 'utf8'));
const root = roots.find((item) => item.keyId === envelope.keyId);
assert.ok(root);
verifyPackage(envelope, new Map([[root.keyId, root]]));

test('opaque signed workbench handles parameters, retry, deltas, context and task resume', { timeout: 30000 }, async (t) => {
  const loaded = new Set();
  let taskReads = 0;
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/') {
      response.setHeader('content-type', 'text/html');
      response.end(`<iframe id="app" sandbox="allow-scripts" src="/index.html?launchTicket=test" style="width:100%;height:760px;border:0"></iframe><script>
        window.bridgeCalls=[]; window.submitAttempts=0;
        window.addEventListener('message', e => {
          if(e.source!==document.querySelector('iframe').contentWindow)return;
           if(e.data.type==='dgos.app.ready'){window.readyMessage=e.data;return;}
           if(e.data.type!=='dgos.app.invoke')return;
           window.bridgeCalls.push(e.data);
           if(e.data.capability==='dgos.aiTask.submit' && ++window.submitAttempts===1)return;
           if(e.data.capability==='dgos.system.context.events' && window.denyContext){
            window.deniedContextRequests=(window.deniedContextRequests||0)+1;
            e.source.postMessage({type:'dgos.host.result',instanceId:e.data.instanceId,requestId:e.data.requestId,error:{errorKey:'permission_denied',message:'permission_denied'}},'*');return;
          }
          const calls=window.bridgeCalls;
          const taskReads=calls.filter(x=>x.capability==='dgos.aiTask.get').length;
          const answers={
            'dgos.model.list':{items:[{providerConfigId:'provider-1',modelId:'model-1',displayName:'Fixture model',intent:'text.chat'}]},
            'dgos.model.resolve':{providerConfigId:'provider-1',modelId:'model-1',intent:'text.chat',descriptorVersion:'text.v1',profile:'responses',workflow:'text.chat',defaults:{temperature:0.4,maxOutputTokens:9},limits:{maxInputCharacters:20,maxOutputTokens:12},uiSchemas:{parameters:['temperature','maxOutputTokens']},assets:{}},
            'dgos.system.context.read':{contextVersion:'1',appId:'dgos.ai-workbench',instanceId:e.data.instanceId,appearance:{appearanceMode:'dark'},locale:{uiLocale:'zh-CN',effectiveLocale:'zh-CN',regionFormat:'zh-CN',assistantLanguage:'zh-CN'}},
            'dgos.system.context.events':{items:[{contextVersion:'2',appearance:{appearanceMode:'light'},locale:{uiLocale:'en-US',effectiveLocale:'en-US',regionFormat:'en-US',assistantLanguage:'en-US'}}],cursor:'2',reset:false},
            'dgos.aiTask.submit':{taskId:'task-1',status:'accepted'},
            'dgos.aiTask.events':{items:e.data.input.cursor===0?[{sequence:1,type:'text.delta',delta:'Fixture '},{sequence:2,type:'text.delta',delta:'response'}]:[]},
            'dgos.aiTask.get':taskReads<2?{taskId:'task-1',status:'running',artifactIds:[]}:{taskId:'task-1',status:'succeeded',text:'Fixture response',artifactIds:['artifact-1']},
            'dgos.aiTask.cancel':{taskId:'task-1',status:'cancel_requested'},
            'dgos.artifact.read':{artifactId:'artifact-1',mimeType:'text/plain',content:'Fixture artifact'}
          };
          e.source.postMessage({type:'dgos.host.result',instanceId:e.data.instanceId,requestId:e.data.requestId,result:answers[e.data.capability]},'*');
        });
      </script>`);
      return;
    }
    const path = url.pathname.slice(1);
    if (!envelope.files[path] || url.searchParams.get('launchTicket') !== 'test') { response.statusCode = 403; response.end(); return; }
    loaded.add(path);
    response.setHeader('content-type', path.endsWith('.html') ? 'text/html' : path.endsWith('.css') ? 'text/css' : 'text/javascript');
    if (path.endsWith('.html')) response.setHeader('content-security-policy', "sandbox allow-scripts; default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'none'");
    const content = Buffer.from(envelope.files[path], 'base64').toString();
    response.end(path.endsWith('.html') ? content.replaceAll('__DGOS_LAUNCH_TICKET__', 'test') : content);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true });
  t.after(async () => { await browser.close(); await new Promise((resolve) => server.close(resolve)); });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const frame = page.frameLocator('#app');
  await frame.locator('#status').waitFor();
  await page.evaluate(() => {
    const sibling = document.createElement('iframe');
    document.body.append(sibling);
    sibling.contentWindow.eval("parent.document.querySelector('#app').contentWindow.postMessage({ type: 'dgos.host.hello', instanceId: 'forged', bridgeVersion: 1 }, '*')");
  });
  assert.equal(await page.evaluate(() => window.readyMessage), undefined);
  await page.locator('#app').evaluate((iframe) => iframe.contentWindow.postMessage({ type: 'dgos.host.hello', instanceId: 'fixture', bridgeVersion: 1 }, '*'));
  await frame.locator('html[data-theme="dark"][lang="zh-CN"]').waitFor();
  assert.equal((await page.evaluate(() => window.readyMessage)).type, 'dgos.app.ready');
  await page.locator('#app').evaluate((iframe) => iframe.contentWindow.postMessage({ type: 'dgos.host.hello', instanceId: 'stale', bridgeVersion: 1 }, '*'));
  assert.equal((await page.evaluate(() => window.readyMessage)).instanceId, 'fixture');
  assert.equal(envelope.manifest.permissions.length, 9);
  assert.deepEqual(envelope.manifest.permissions, envelope.manifest.capabilityAllowlist);
  assert.equal(await frame.locator('h1').evaluate((node) => getComputedStyle(node).color !== ''), true);
  await frame.locator('#model').selectOption('0');
  await frame.locator('#parameters input[name="temperature"]').waitFor();
  await frame.locator('#parameters input[name="temperature"]').fill('0.7');
  await frame.locator('#parameters input[name="maxOutputTokens"]').fill('10');
  await frame.locator('#prompt').fill('hello');
  await frame.locator('#parameters input[name="maxOutputTokens"]').fill('13');
  await frame.locator('#submit').click();
  assert.equal((await page.evaluate(() => window.bridgeCalls)).filter((item) => item.capability === 'dgos.aiTask.submit').length, 0);
  await frame.locator('#parameters input[name="maxOutputTokens"]').fill('10');
  await frame.locator('#submit').click();
  await page.waitForFunction(() => window.bridgeCalls.some((item) => item.capability === 'dgos.aiTask.submit'));
  await frame.locator('#retry-submit').waitFor({ state: 'visible', timeout: 15000 });
  await frame.locator('#retry-submit').click();
  await frame.locator('#result').getByText('Fixture response').waitFor();
  assert.equal(await frame.locator('#status').textContent(), 'running');
  await frame.locator('#status').getByText('succeeded').waitFor();
  await frame.locator('#artifacts button').click();
  await frame.locator('#artifacts pre').getByText('Fixture artifact').waitFor();
  const calls = await page.evaluate(() => window.bridgeCalls);
  const submits = calls.filter((item) => item.capability === 'dgos.aiTask.submit');
  assert.equal(submits.length, 2);
  assert.equal(submits[0].requestId, submits[1].requestId);
  assert.deepEqual(submits[0].input.options.parameters, { temperature: 0.7, maxOutputTokens: 10 });
  assert.equal(calls.filter((item) => item.capability === 'dgos.model.resolve').length, 1);
  assert.ok(calls.some((item) => item.capability === 'dgos.aiTask.events' && item.input.cursor === 0));
  await frame.locator('#task-id').fill('task-1');
  await frame.locator('#resume').click();
  await frame.locator('#result').getByText('Fixture response').waitFor();
  await frame.locator('html[data-theme="light"][lang="en"]').waitFor({ timeout: 5000 });
  const contextCalls = (await page.evaluate(() => window.bridgeCalls)).filter((item) => item.capability === 'dgos.system.context.events');
  assert.equal(typeof contextCalls[0].input.cursor, 'string');
  await page.evaluate(() => { window.denyContext = true; });
  await page.waitForTimeout(2500);
  const deniedContextCalls = await page.evaluate(() => window.bridgeCalls.filter((item) => item.capability === 'dgos.system.context.events'));
  assert.ok(deniedContextCalls.length > 0, `context poll did not run after deny: ${JSON.stringify(deniedContextCalls)}`);
  await page.waitForFunction(() => window.deniedContextRequests > 0, undefined, { timeout: 5000 });
  const contextCount = (await page.evaluate(() => window.bridgeCalls)).filter((item) => item.capability === 'dgos.system.context.events').length;
  await page.waitForTimeout(2200);
  assert.equal((await page.evaluate(() => window.bridgeCalls)).filter((item) => item.capability === 'dgos.system.context.events').length, contextCount);
  assert.deepEqual([...loaded].sort(), ['index.html', 'tokens.css', 'workbench.css', 'workbench.js']);
});
