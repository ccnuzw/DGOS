import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(new URL('..', import.meta.url).pathname);
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const apiBase = process.env.API_BASE_URL;
const server = http.createServer(async (req, res) => {
  if (apiBase && req.url?.startsWith('/api/')) {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const upstream = await fetch(`${apiBase}${req.url}`, { method: req.method, headers: req.headers, body: chunks.length ? Buffer.concat(chunks) : undefined });
    res.writeHead(upstream.status, Object.fromEntries(upstream.headers)); return res.end(Buffer.from(await upstream.arrayBuffer()));
  }
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); const file = path.join(root, pathname === '/' ? 'index.html' : pathname); if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('Not found'); } res.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
});
server.listen(Number(process.env.PORT || 4173), process.env.HOST || '127.0.0.1', () => console.log(`DGOS web listening on http://${process.env.HOST || '127.0.0.1'}:${process.env.PORT || 4173}`));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
