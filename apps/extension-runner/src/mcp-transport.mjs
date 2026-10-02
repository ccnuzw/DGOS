import { spawn } from 'node:child_process';
import { realpath, stat } from 'node:fs/promises';
import { dirname, isAbsolute, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { invalid } from '../../../src/extensions/validation.mjs';

function parseMessage(text) {
  const trimmed=text.trim();
  if (trimmed.startsWith('data:')) return JSON.parse(trimmed.slice(5).trim());
  return JSON.parse(trimmed);
}
const under=(path,root)=>path===root||path.startsWith(`${root}${sep}`);
const repositoryRoot=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
function approvedRoot(path) {
  if(!isAbsolute(path)||under(path,'/var/lib/dgos')||under(path,'/run')||under(path,'/root')||under(path,'/home')||under(path,'/Users')&&path.split('/').length<5)throw invalid('runner_profile_invalid',503);
  if(path===repositoryRoot||['/','/workspace','/Users','/home','/root','/run','/var','/var/lib','/var/lib/dgos','/tmp','/private','/etc'].includes(path))throw invalid('runner_profile_invalid',503);
  if(path.startsWith('/workspace/')&&path.split('/').length<5)throw invalid('runner_profile_invalid',503);
  return path;
}
async function runtimeRoots(profile,cwd) {
  if(!Array.isArray(profile.readOnlyRoots??[])||profile.readOnlyRoots?.length>8)throw invalid('runner_profile_invalid',503);
  approvedRoot(cwd);const roots=[cwd];
  for(const root of profile.readOnlyRoots??[]) {
    if(!isAbsolute(root)||root!==resolve(root)||root===repositoryRoot)throw invalid('runner_profile_invalid',503);
    approvedRoot(root);const actual=await realpath(root);approvedRoot(actual);
    if(!(await stat(actual)).isDirectory())throw invalid('runner_profile_invalid',503);
    roots.push(actual);
  }
  return [...new Set(roots)];
}
async function linuxReadView(command,roots) {
  const args=['--unshare-user','--unshare-pid','--unshare-ipc','--unshare-net','--die-with-parent'];
  const made=new Set();const addDirs=(path)=>{for(let index=1;index<path.length;index++)if(path[index]==='/') {const dir=path.slice(0,index);if(dir&&!made.has(dir)){args.push('--dir',dir);made.add(dir);}}};
  for(const path of ['/usr/lib','/usr/lib64','/lib','/lib64','/usr/local/lib','/etc/ld.so.cache']) {
    try {const actual=await realpath(path);addDirs(path);if(!made.has(path)){args.push('--ro-bind',actual,path);made.add(path);}}catch(error){if(error.code!=='ENOENT')throw error;}
  }
  addDirs(command);args.push('--ro-bind',command,command);
  for(const root of roots) {addDirs(root);args.push('--ro-bind',root,root);}
  return [...args,'--dev','/dev','--dir','/proc','--remount-ro','/'];
}
function macPolicy(command,roots) {
  const literals=[command,'/dev/null','/dev/urandom'].map((path)=>`(literal ${JSON.stringify(path)})`).join(' ');
  const subpaths=['/System/Library','/usr/lib','/usr/local/lib',...roots].map((path)=>`(subpath ${JSON.stringify(path)})`).join(' ');
  const metadata=new Set();for(const path of [command,...roots]){let parent=dirname(path);while(parent!=='/'){metadata.add(parent);parent=dirname(parent);}}
  const ancestors=[...metadata].map((path)=>`(literal ${JSON.stringify(path)})`).join(' ');
  return `(version 1)(deny default)(allow process-exec (literal ${JSON.stringify(command)}))(allow file-read* ${literals} ${subpaths})(allow file-read-metadata ${ancestors})(allow file-read-data (literal "/"))(deny file-write*)(deny network*)`;
}
export class StdioMcpConnection {
  constructor(profile,credentials) { this.profile=profile; this.credentials=credentials; this.pending=new Map(); this.nextId=1; this.buffer=''; this.closed=false; }
  async open() {
    const p=this.profile;
    if(!isAbsolute(p.command)||!isAbsolute(p.cwd)||!Array.isArray(p.args)||p.args.some((x)=>typeof x!=='string')) throw invalid('runner_profile_invalid',503);
    const command=await realpath(p.command); const cwd=await realpath(p.cwd);approvedRoot(cwd);
    if(p.allowedCommand && command!==await realpath(p.allowedCommand)) throw invalid('runner_profile_invalid',503);
    if(p.allowedCwdRoot && !(cwd===await realpath(p.allowedCwdRoot)||cwd.startsWith(`${await realpath(p.allowedCwdRoot)}/`))) throw invalid('runner_profile_invalid',503);
    const sandbox=p.sandbox==='macos-restricted'&&process.platform==='darwin';
    const linuxSandbox=p.sandbox==='linux-bwrap'&&process.platform==='linux';
    if(p.sandbox&&!sandbox&&!linuxSandbox) throw invalid('sandbox_required',503);
    const roots=await runtimeRoots(p,cwd);
    const policy=sandbox?macPolicy(command,roots):null;
    const linuxArgs=linuxSandbox?[...await linuxReadView(command,roots),'--chdir',cwd,'--',command,...p.args]:null;
    const credentialEnv={};
    for(const [field,name] of Object.entries(p.credentialEnv??{})) {
      const value=this.credentials?.[field];if(typeof value!=='string'||!value)throw invalid('credential_unavailable',409);
      credentialEnv[name]=value;
    }
    this.credentials=null;
    this.child=spawn(sandbox?'/usr/bin/sandbox-exec':linuxSandbox?'/usr/bin/bwrap':command,sandbox?['-p',policy,command,...p.args]:linuxSandbox?linuxArgs:p.args,{cwd,env:{PATH:'/usr/bin:/bin',LANG:'C',HOME:'/nonexistent',...credentialEnv},stdio:['pipe','pipe','ignore'],windowsHide:true});
    this.child.stdout.on('data',(chunk)=>{ this.buffer+=chunk; if(this.buffer.length>262144) return this.close(); let end; while((end=this.buffer.indexOf('\n'))>=0) { const line=this.buffer.slice(0,end); this.buffer=this.buffer.slice(end+1); if(!line.trim()) continue; try { const msg=parseMessage(line); const waiting=this.pending.get(msg.id); if(waiting) { this.pending.delete(msg.id); msg.error?waiting.reject(invalid('mcp_protocol_error',502)):waiting.resolve(msg.result); } } catch { this.close(); } } });
    this.child.on('error',()=>this.close()); this.child.on('exit',()=>this.close());
    try { await this.request('initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'dgos',version:'1.0.0'}},p.timeoutMs??5000); this.child.stdin.write(`${JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})}\n`); }
    catch(error) { this.close(); throw error; }
    return this;
  }
  request(method,params={},timeoutMs=5000) {
    if(this.closed||!this.child) throw invalid('connection_not_ready',409);
    const id=this.nextId++;
    return new Promise((resolve,reject)=>{ const timer=setTimeout(()=>{this.pending.delete(id);reject(invalid('timeout',504));this.close();},Math.min(timeoutMs,60000)); this.pending.set(id,{resolve:(v)=>{clearTimeout(timer);resolve(v);},reject:(e)=>{clearTimeout(timer);reject(e);}}); this.child.stdin.write(`${JSON.stringify({jsonrpc:'2.0',id,method,params})}\n`); });
  }
  close() { if(this.closed)return; this.closed=true; for(const waiting of this.pending.values()) waiting.reject(invalid('connection_not_ready',503)); this.pending.clear(); this.child?.kill('SIGKILL'); }
}

export class HttpMcpConnection {
  constructor(profile,credentials) { this.profile=profile; this.nextId=1; this.sessionId=null; this.closed=false; this.credentialHeaders={};for(const [field,binding] of Object.entries(profile.credentialHeaders??{})){const value=credentials?.[field];if(typeof value!=='string'||!value)throw invalid('credential_unavailable',409);this.credentialHeaders[binding.name]=`${binding.prefix??''}${value}`;} }
  async open() { await this.request('initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'dgos',version:'1.0.0'}}); await this.request('notifications/initialized',{},3000,true); return this; }
  async request(method,params={},timeoutMs=5000,notification=false) {
    if(this.closed) throw invalid('connection_not_ready',409);
    const url=this.profile.endpoint;
    if(typeof url!=='string'||!url.startsWith('https://')&&!this.profile.allowHttpFixture) throw invalid('endpoint_invalid',422);
    const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),Math.min(timeoutMs,60000));
    try {
      const id=notification?undefined:this.nextId++;
      const request={url,method:'POST',signal:controller.signal,headers:{'content-type':'application/json','accept':'application/json, text/event-stream',...this.credentialHeaders,...(this.sessionId?{'mcp-session-id':this.sessionId}:{})},body:JSON.stringify({jsonrpc:'2.0',...(id?{id}:{}),method,params})};
      const response=this.profile.allowHttpFixture?await fetch(url,{...request,redirect:'manual'}):await this.profile.egress?.request(request);
      if(!response) throw invalid('egress_unavailable',503);
      if(!response.ok||response.status>=300) throw invalid('connection_failed',502);
      this.sessionId=(typeof response.headers.get==='function'?response.headers.get('mcp-session-id'):response.headers['mcp-session-id'])??this.sessionId;
      if(notification||response.status===202) return {};
      const text=await response.text(); if(text.length>262144) throw invalid('mcp_protocol_error',502);
      const contentType=typeof response.headers.get==='function'?response.headers.get('content-type'):response.headers['content-type'];
      const data=contentType?.includes('text/event-stream')?text.split('\n').filter((line)=>line.startsWith('data:')).at(-1):text;
      const message=parseMessage(data); if(message.error) throw invalid('mcp_protocol_error',502); return message.result;
    } catch(error) { if(error.name==='AbortError') throw invalid('timeout',504); throw error; }
    finally { clearTimeout(timer); }
  }
  async close() { this.closed=true; if(this.sessionId) { try { const request={url:this.profile.endpoint,method:'DELETE',headers:{'mcp-session-id':this.sessionId,...this.credentialHeaders}}; if(this.profile.allowHttpFixture) await fetch(request.url,{method:request.method,redirect:'manual',headers:request.headers}); else await this.profile.egress?.request(request); } catch {} } this.credentialHeaders={}; }
}
