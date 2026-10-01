import http from 'node:http';
import { createOpenAiCompatibleFixture } from '../test-support/openai-compatible-fixture.mjs';
const fixture = createOpenAiCompatibleFixture({ chunks: ['hello ', 'world'] });
const upstream = await fixture.start();
let scenario = 'success';
const server = http.createServer(async (req, res) => {
  if (req.url === '/__fixture') {
    if (req.method === 'POST') { let body = ''; for await (const chunk of req) body += chunk; scenario = JSON.parse(body).scenario; }
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ scenario, requests: fixture.requests }));
  }
  const controller = new AbortController();
  res.on('close', () => { if (!res.writableEnded) controller.abort(); });
  try {
    let body = ''; for await (const chunk of req) body += chunk;
    const response = await fetch(upstream.baseUrl.replace('/v1', '') + req.url, { method: req.method, headers: { authorization: req.headers.authorization, 'content-type': 'application/json', 'x-fixture-scenario': scenario }, body: body || undefined, signal: controller.signal });
    res.writeHead(response.status, { 'content-type': response.headers.get('content-type') });
    for await (const chunk of response.body) res.write(chunk);
    res.end();
  } catch { res.destroy(); }
});
server.listen(4080, '0.0.0.0');
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { server.close(); fixture.close().then(() => process.exit(0)); });
