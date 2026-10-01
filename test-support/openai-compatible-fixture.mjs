import http from 'node:http';

const DEFAULT_TOKEN = 'dgos-fixture-token';
const DEFAULT_MODEL = 'fixture-text-model';

const json = (value) => JSON.stringify(value);
const scenarioFrom = (request, fallback) => {
  const url = new URL(request.url, 'http://fixture.local');
  return url.searchParams.get('scenario') || request.headers['x-fixture-scenario'] || fallback;
};

const errorBody = (message) => ({ error: { message, type: 'fixture_error', code: message } });

export function createOpenAiCompatibleFixture(options = {}) {
  const token = options.token ?? process.env.DGOS_FIXTURE_TOKEN ?? DEFAULT_TOKEN;
  const model = options.model ?? process.env.DGOS_FIXTURE_MODEL ?? DEFAULT_MODEL;
  const defaultScenario = options.scenario ?? process.env.DGOS_FIXTURE_SCENARIO ?? 'success';
  const delayMs = Number(options.delayMs ?? process.env.DGOS_FIXTURE_DELAY_MS ?? 0);
  const requests = [];
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://fixture.local');
    const scenario = scenarioFrom(request, defaultScenario);
    requests.push({ method: request.method, path: url.pathname, scenario, at: new Date().toISOString() });
    const auth = request.headers.authorization;
    if (scenario === 'forbidden') {
      response.writeHead(403, { 'content-type': 'application/json' });
      response.end(json(errorBody('forbidden')));
      return;
    }
    if (auth !== `Bearer ${token}`) {
      response.writeHead(401, { 'content-type': 'application/json', 'www-authenticate': 'Bearer' });
      response.end(json(errorBody('invalid_api_key')));
      return;
    }
    if (scenario === 'timeout') {
      await new Promise((resolve) => setTimeout(resolve, Number(url.searchParams.get('delayMs') ?? delayMs ?? 30_000)));
    }
    if (url.pathname === '/v1/models' && request.method === 'GET') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(json({ object: 'list', data: [{ id: model, object: 'model', created: 0, owned_by: 'dgos-fixture', name: 'DGOS Fixture Text' }] }));
      return;
    }
    if (url.pathname === '/v1/chat/completions' && request.method === 'POST') {
      let body = '';
      try { for await (const chunk of request) body += chunk; } catch (error) {
        if (error.code === 'ECONNRESET' || error.code === 'ECONNABORTED') return;
        throw error;
      }
      if (scenario === 'empty') {
        response.writeHead(200, { 'content-type': 'text/event-stream' });
        response.end();
        return;
      }
      if (scenario === 'malformed') {
        response.writeHead(200, { 'content-type': 'text/event-stream' });
        response.end('data: {not-json}\n\n');
        return;
      }
      response.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', connection: 'keep-alive' });
      const input = (() => { try { return JSON.parse(body)?.messages?.at(-1)?.content; } catch { return undefined; } })();
      const chunks = options.chunks ?? [options.responseText ?? `fixture response${input ? `: ${input}` : ''}`];
      const write = (line) => response.write(`data: ${json({ id: 'fixture-completion', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content: line }, finish_reason: null }] })}\n\n`);
      for (const chunk of chunks) {
        if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
        write(chunk);
      }
      if (scenario === 'disconnect') {
        response.destroy();
        return;
      }
      if (scenario === 'malformed-after-data') response.write('data: {not-json}\n\n');
      else response.write('data: [DONE]\n\n');
      response.end();
      return;
    }
    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(json(errorBody('not_found')));
  });

  return {
    server,
    token,
    model,
    requests,
    get requestCount() { return requests.length; },
    async start(port = options.port ?? Number(process.env.DGOS_FIXTURE_PORT ?? 0), host = options.host ?? '127.0.0.1') {
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
      const address = server.address();
      return { port: address.port, host, baseUrl: `http://${host}:${address.port}/v1` };
    },
    async close() {
      if (!server.listening) return;
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  };
}

if (process.argv[1] && new URL(`file://${process.argv[1]}`).pathname === new URL(import.meta.url).pathname) {
  const fixture = createOpenAiCompatibleFixture();
  const address = await fixture.start();
  process.stdout.write(`${JSON.stringify({ ...address, token: fixture.token })}\n`);
  const shutdown = async () => { await fixture.close(); process.exit(0); };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
