import { pathToFileURL } from 'node:url';
const [modulePath, exportName] = process.argv.slice(2);
let text = '';
for await (const chunk of process.stdin) {
  text += chunk;
  if (text.length > 65_536) process.exit(2);
}
try {
  const handler = (await import(pathToFileURL(modulePath)))[exportName];
  if (typeof handler !== 'function') throw new Error('handler_unavailable');
  const result = await handler(JSON.parse(text));
  process.stdout.write(JSON.stringify({ ok: true, result }));
} catch {
  process.stdout.write(JSON.stringify({ ok: false }));
}
