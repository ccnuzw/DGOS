import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 4173);
const apiBase = process.env.API_BASE_URL ? new URL(process.env.API_BASE_URL) : null;
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2'};

if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('Web dist missing. Run pnpm --filter @dgos/web build.');

const server = http.createServer((request, response) => {
  const pathname = new URL(request.url || '/', 'http://localhost').pathname;
  if (pathname.startsWith('/api/')) {
    if (!apiBase) { response.writeHead(503, {'content-type':'application/json'}); response.end(JSON.stringify({errorKey:'api_unavailable',message:'API_BASE_URL is not configured'})); return; }
    const target = new URL(request.url || '/', apiBase);
    const transport = target.protocol === 'https:' ? https : http;
    const upstream = transport.request(target, {method:request.method,headers:{...request.headers,host:target.host}}, incoming => {
      response.writeHead(incoming.statusCode || 502, incoming.headers);
      incoming.pipe(response);
    });
    upstream.on('error', () => {if (!response.headersSent) response.writeHead(502, {'content-type':'application/json'});response.end(JSON.stringify({errorKey:'api_unavailable',message:'API upstream unavailable'}));});
    request.pipe(upstream);
    return;
  }
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch {response.writeHead(400);response.end('Bad path');return;}
  const file = path.resolve(dist, `.${decoded}`);
  if (!file.startsWith(`${dist}${path.sep}`) && file !== dist) {response.writeHead(403);response.end('Forbidden');return;}
  const candidate = fs.existsSync(file) && fs.statSync(file).isFile() ? file : pathname.includes('.') ? null : path.join(dist, 'index.html');
  if (!candidate) {response.writeHead(404);response.end('Not found');return;}
  response.writeHead(200, {'content-type':mime[path.extname(candidate)] || 'application/octet-stream','cache-control':candidate.endsWith('index.html')?'no-cache':'public, max-age=31536000, immutable'});
  fs.createReadStream(candidate).pipe(response);
});

server.listen(port, host, () => console.log(`DGOS web listening on http://${host}:${port}`));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
