import { spawn } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { invalid } from '../../../src/extensions/validation.mjs';
import { StdioMcpConnection, HttpMcpConnection } from './mcp-transport.mjs';
import { digest } from '../../../src/extensions/validation.mjs';

// The process only receives a server-owned binding. A manifest cannot name a binary.
export class IsolatedExtensionRunner {
  constructor({ handlers = {}, timeoutMs = 15_000, allowedModuleRoots = [], runnerProfiles = {}, endpointProfiles = {} } = {}) { Object.assign(this,{handlers,timeoutMs,allowedModuleRoots,runnerProfiles,endpointProfiles}); this.connections=new Map(); }
  bindingKey({subjectId,kind,extensionId,version,config}) { if(!subjectId||!kind||!extensionId||!version) throw invalid('runner_binding_invalid',422); return JSON.stringify([subjectId,kind,extensionId,version,digest(config??{})]); }
  hasConnection(binding) { const connection=this.connections.get(this.bindingKey(binding)); return Boolean(connection&&!connection.closed); }
  async invoke({ subjectId,kind, extensionId,version, operationId, input, signal, timeoutMs = this.timeoutMs, config }) {
    if(kind==='mcp' && config?.transport) {
      const connection=this.connections.get(this.bindingKey({subjectId,kind,extensionId,version,config})); if(!connection||connection.closed) throw invalid('connection_not_ready',409);
      if(signal?.aborted) throw invalid('cancelled',409);
      const abort=()=>connection.close(); signal?.addEventListener('abort',abort,{once:true});
      try { const result=await connection.request('tools/call',{name:operationId,arguments:input},timeoutMs); return result?.structuredContent??{content:result?.content??[]}; }
      finally { signal?.removeEventListener('abort',abort); }
    }
    const binding = this.handlers[`${kind}:${extensionId}:${operationId}`];
    if (!binding) throw invalid('handler_unavailable', 503);
    if (typeof binding === 'function') return binding(input, { signal }); // fixture-only adapter
    if (!binding.moduleUrl || !binding.exportName) throw invalid('handler_unavailable', 503);
    const modulePath = await realpath(fileURLToPath(binding.moduleUrl));
    const roots = await Promise.all(this.allowedModuleRoots.map((root) => realpath(root)));
    if (!roots.some((root) => modulePath.startsWith(`${root}/`))) throw invalid('handler_unavailable', 503);
    const child = spawn(process.execPath, ['--max-old-space-size=64', '--disable-proto=throw', fileURLToPath(new URL('./child.mjs', import.meta.url)), modulePath, binding.exportName], {
      cwd: dirname(modulePath), env: { PATH: '/usr/bin:/bin', LANG: 'C', HOME: '/nonexistent' },
      stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true,
    });
    return new Promise((resolve, reject) => {
      let settled = false; let output = '';
      const finish = (error, value) => { if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort); child.kill('SIGKILL'); error ? reject(error) : resolve(value); };
      const abort = () => finish(invalid('cancelled', 409));
      const timer = setTimeout(() => finish(invalid('timeout', 504)), Math.min(timeoutMs, 60_000));
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) abort();
      child.stdout.on('data', (chunk) => { output += chunk; if (output.length > 65_536) finish(invalid('handler_failed', 502)); });
      child.on('error', () => finish(invalid('handler_failed', 502)));
      child.on('exit', (code) => { if (settled) return; if (code !== 0) return finish(invalid('handler_failed', 502)); try { const message = JSON.parse(output); message.ok ? finish(null, message.result) : finish(invalid('handler_failed', 502)); } catch { finish(invalid('handler_failed', 502)); } });
      child.stdin.end(JSON.stringify(input));
    });
  }
  async connect({ subjectId,kind, extensionId,version, signal, config, credentials }) {
    if(kind==='mcp' && config?.transport) {
      const key=this.bindingKey({subjectId,kind,extensionId,version,config});
      let connection=this.connections.get(key);
      if(connection && !connection.closed) return (await connection.request('tools/list')).tools;
      const profile=config.transport==='stdio'?this.runnerProfiles[config.runnerProfileId]:this.endpointProfiles[config.endpointRef];
      if(!profile) throw invalid('runner_profile_unavailable',503);
      connection=config.transport==='stdio'?new StdioMcpConnection(profile,credentials):new HttpMcpConnection(profile,credentials);
      await connection.open(); this.connections.set(key,connection);
      try { const catalog=await connection.request('tools/list'); if(!Array.isArray(catalog.tools)) throw invalid('mcp_protocol_error',502); return catalog.tools; }
      catch(error) { await connection.close(); this.connections.delete(key); throw error; }
    }
    const binding = this.handlers[`${kind}:${extensionId}:__connect`];
    if (!binding) throw invalid('handler_unavailable', 503);
    const result = await this.invoke({ kind, extensionId, operationId: '__connect', input: {}, signal });
    if (!result?.healthy || !Array.isArray(result.tools)) throw invalid('connection_failed', 502);
    return result.tools;
  }
  async disconnect(binding) { const key=this.bindingKey(binding); const connection=this.connections.get(key); if(connection) { await connection.close(); this.connections.delete(key); } return {stopped:true}; }
  async close() { const connections=[...this.connections.values()]; this.connections.clear(); await Promise.allSettled(connections.map((connection)=>connection.close())); }
}
