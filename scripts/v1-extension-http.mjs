import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, randomBytes, randomUUID, sign } from 'node:crypto';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import pg from '../apps/api/node_modules/pg/lib/index.js';
import { buildServer } from '../apps/api/src/server.mjs';
import { DiskPackageStore, canonicalJson } from '../src/apps/package-service.mjs';
import { discoverMigrations, buildMigrationSql } from './migrate.mjs';
import { selectedMigrations } from './v1-performance.mjs';

const adminUrl = new URL(process.env.DGOS_EXTENSION_TEST_DATABASE_URL ?? 'postgresql://dgos:dgos@127.0.0.1:5432/dgos_v1_extensions_r3final');
if (adminUrl.protocol !== 'postgresql:' || adminUrl.hostname !== '127.0.0.1' || adminUrl.port !== '5432' || adminUrl.pathname !== '/dgos_v1_extensions_r3final' || adminUrl.username !== 'dgos' || adminUrl.search || adminUrl.hash) throw new Error('dedicated_local_extension_parent_required');
const databaseName = `dgos_v1_ext_http_${randomBytes(16).toString('hex')}`;
const childUrl = new URL(adminUrl); childUrl.pathname = `/${databaseName}`;
const databaseUrl = childUrl.href;
const port = Number(process.env.DGOS_EXTENSION_HTTP_PORT ?? 15141);
assert.ok(Number.isInteger(port) && port >= 15141 && port <= 15149);
const previousDatabaseUrl = process.env.DGOS_DATABASE_URL;
const runId = `V1-EXT-http-${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${databaseName.slice(-8)}`;
const evidenceRoot = resolve('.herdr');
const evidencePath = join(evidenceRoot, `${runId}.json`);
const manifestPath = join(evidenceRoot, `${runId}-manifest.json`);
const files = ['scripts/v1-extension-http.mjs','scripts/v1-performance.mjs','tests/extensions/extension-http-daemon.mjs','apps/api/src/server.mjs','apps/api/src/extension-routes.mjs','apps/extension-runner/src/daemon.mjs','src/extensions/service.mjs','src/extensions/runtime.mjs','src/apps/package-service.mjs'];
const report = {runId, environment:'local-dedicated-postgresql-real-http', database:databaseName, port, startedAt:new Date().toISOString(), cases:[], limitations:['Local signed package fixture and macOS sandbox are not production deployment evidence.','V1 schema permits one active admin principal, so a second authenticated subject cannot be produced through the public identity API in this database.','API uses buildServer with real routes and repositories; extension daemon runs in a separate Node process in this harness.']};
const admin = new pg.Pool({connectionString:adminUrl.href});
let pool, created = false;
const directory = await mkdtemp(join(tmpdir(),'dgos-extension-http-'));
const packageRoot = new DiskPackageStore(join(directory,'packages'));
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
let api, daemon;
let phase='preflight';
const sha=(data)=>`sha256:${createHash('sha256').update(data).digest('hex')}`;
const record=(name,facts={})=>{report.cases.push({name,result:'passed',facts});console.log(JSON.stringify({case:name,result:'passed'}));};
const sleep=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms));
const waitFor=async(name,read,predicate)=>{const until=Date.now()+12000;let value;while(Date.now()<until){value=await read();if(predicate(value))return value;await sleep(80);}throw new Error(`${name}_timeout:${JSON.stringify(value)}`);};
const daemonPath=fileURLToPath(new URL('../tests/extensions/extension-http-daemon.mjs',import.meta.url));
async function startDaemon(configPath){
  const child=spawn(process.execPath,[daemonPath],{env:{...process.env,DGOS_EXTENSION_TEST_DATABASE_URL:databaseUrl,DGOS_EXTENSION_CONFIG_FILE:configPath},stdio:['ignore','pipe','pipe']});
  let output='';let errors='';child.stderr.on('data',(chunk)=>{errors+=chunk;});
  try {
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('daemon_start_timeout')),5000);child.stdout.on('data',(chunk)=>{output+=chunk;if(output.includes('extension-daemon-ready')){clearTimeout(timer);resolve();}});child.once('exit',(code)=>{clearTimeout(timer);reject(new Error(`daemon_exit_${code}:${errors.slice(0,500)}`));});child.once('error',(error)=>{clearTimeout(timer);reject(error);});});
    return child;
  } catch(error){if(child.exitCode===null&&!child.signalCode){await new Promise((resolve)=>{const timer=setTimeout(()=>{child.kill('SIGKILL');resolve();},5000);child.once('exit',()=>{clearTimeout(timer);resolve();});child.kill('SIGTERM');});}throw error;}
}
async function stopDaemon(){if(!daemon)return;const child=daemon;daemon=null;if(child.exitCode!==null||child.signalCode)return;await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('daemon_stop_timeout'));},5000);child.once('exit',(code)=>{clearTimeout(timer);code===0?resolve():reject(new Error(`daemon_stop_${code}`));});child.kill('SIGTERM');});}
const appId=`com.example.ext${randomUUID().replaceAll('-','')}`;
const requestId=()=>randomUUID();
let baseUrl, session;
async function http(path,{method='GET',body,auth=session,status=200}={}){
  const response=await fetch(`${baseUrl}/api/v1${path}`,{method,headers:{...(auth?{authorization:`Bearer ${auth}`}:{}) ,...(body?{'content-type':'application/json'}:{}),...(!['GET','HEAD'].includes(method)?{'x-dgos-csrf':'extension-http',origin:baseUrl}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(8000)});
  const text=await response.text();let value;try{value=text?JSON.parse(text):null;}catch{value=text;}
  if(response.status!==status)throw new Error(`${method} ${path}: HTTP ${response.status}, expected ${status}, errorKey=${value?.errorKey??'none'}`);
  return value;
}
const permission=(targetApp,capability,scope='*',decision='allow')=>http('/permissions',{method:'PATCH',body:{requestId:requestId(),appId:targetApp,capability,scope,decision}});
function envelope(manifest){
  const html=Buffer.from('<html><body>Extension fixture</body></html>'); const icon=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>');
  const resourceDigests={'index.html':sha(html),'icon.svg':sha(icon)};
  return {requestId:requestId(),manifest,files:{'index.html':html.toString('base64'),'icon.svg':icon.toString('base64')},resourceDigests,keyId:'extension-http',signature:sign(null,Buffer.from(canonicalJson({manifest,resourceDigests})),privateKey).toString('base64')};
}
try {
  const {selected:migrations,actualSetSha}=selectedMigrations(await discoverMigrations());
  await admin.query(`CREATE DATABASE ${databaseName}`);created=true;
  pool=new pg.Pool({connectionString:databaseUrl});
  await pool.query(buildMigrationSql(migrations));
  record('Dedicated schema checksums',{migrationCount:migrations.length,migrationSetSha256:actualSetSha,extensionRecoveryChecksum:migrations.find((item)=>item.version==='0034-extension-recovery').checksum});
  const defaultConfig=JSON.parse(await readFile(new URL('../src/extensions/v1-default-runtime.json',import.meta.url),'utf8'));
  const fixtureDir=fileURLToPath(new URL('../tests/extensions/',import.meta.url));
  defaultConfig.sources.push({source:'system:extension_http_mcp',trustState:'trusted',manifest:{kind:'mcp',id:'extension_http_mcp',version:'1.0.0',operations:[{operationId:'echo',permission:'mcp.tool.invoke',risk:'low',sideEffects:false,inputSchema:{type:'object',required:['value'],properties:{value:{type:'string'}}}}]}});
  defaultConfig.runnerProfiles.extension_http={command:process.execPath,cwd:fixtureDir,args:[join(fixtureDir,'stdio-mcp-fixture.mjs')],sandbox:process.platform==='darwin'?'macos-restricted':'linux-bwrap',timeoutMs:3000};
  const configPath=join(directory,'extensions.json');await writeFile(configPath,JSON.stringify(defaultConfig));
  process.env.DGOS_DATABASE_URL=databaseUrl;
  api=buildServer({logger:false,closeDatabasePools:true,packageOptions:{store:packageRoot,trustRoots:new Map([['extension-http',{source:'official',publicKey}]])},extensionOptions:{configPath}});
  await api.listen({host:'127.0.0.1',port});baseUrl=`http://127.0.0.1:${port}`;
  assert.equal((await fetch(`${baseUrl}/ready`)).status,200);
  daemon=await startDaemon(configPath);
  record('Real API and independent daemon ready',{port,workerProcessId:daemon.pid});

  phase='authentication';
  session=(await http('/identity/admin/bootstrap',{method:'POST',status:201,body:{displayName:runId,credential:`fixture-${randomUUID()}`}})).sessionId;
  const principal=(await http('/identity/admin/session')).principalId;
  record('Authenticated session',{principalId:principal,reusedExistingSession:false,fixtureSessionProvisioned:true});

  phase='signed_app';
  const capabilities=['skill.execute','mcp.tool.invoke'];
  const manifest={format:'dgos-app/v1',appId,version:'1.0.0',build:1,releaseChannel:'stable',minRuntimeVersion:'1.0.0',dataVersion:1,name:{'zh-CN':'扩展测试','en-US':'Extension fixture'},description:{'zh-CN':'扩展测试','en-US':'Extension fixture'},category:'productivity',icon:'icon.svg',defaultWindow:{width:800,height:600},entrypoints:{web:'index.html'},permissions:capabilities,capabilityAllowlist:capabilities,dependencies:{apps:[],skills:[{packageId:'dgos_official_skills',skillId:'text_format',version:'1.0.0',operationIds:['format']}],mcp:[{sourceId:'extension_http_mcp',version:'1.0.0',operationIds:['echo']}]},trustLevel:'standard',uninstallPolicy:'user-removable',backgroundPolicy:'release'};
  const published=await http('/apps',{method:'POST',status:201,body:envelope(manifest)});
  const deployment=await http(`/apps/${appId}/install`,{method:'POST',body:{requestId:requestId(),version:'1.0.0',build:1,releaseChannel:'stable'}});
  assert.equal(deployment.state,'active');record('Signed app deployed',{appId,packageDigest:published.digest,dependencyCount:2});
  for(const kind of ['skill','mcp'])for(const capability of [`${kind}.install`,`${kind}.manage`,`${kind}.read`,`${kind}.uninstall`,`${kind}.execute`,...(kind==='mcp'?['mcp.connect']:[])])await permission('dgos.extensions',capability);
  await permission('dgos.extensions','extension.run.read');await permission('dgos.extensions','extension.run.cancel');
  await permission(appId,'skill.execute','skill:text_format:format');
  await permission(appId,'mcp.tool.invoke','mcp:extension_http_mcp:echo');
  record('Declared capabilities explicitly allowed',{builtinManagement:true,signedAppExecution:true});

  phase='skill';
  const skillPreview=await http('/extensions/previews',{method:'POST',body:{requestId:requestId(),kind:'skill',source:'system:dgos_text_format'}});
  const skill=await http('/skills',{method:'POST',status:202,body:{requestId:requestId(),source:'system:dgos_text_format',previewId:skillPreview.previewId,previewDigest:skillPreview.digest,confirmed:true}});
  const skillEnabled=await http('/skills/text_format/state',{method:'POST',body:{requestId:requestId(),baseVersion:skill.stateVersion,desiredState:'enabled'}});
  const skillRequest={requestId:requestId(),appId,kind:'skill',extensionId:'text_format',operationId:'format',extensionVersion:'1.0.0',input:{text:'  real   HTTP  '}};
  const skillTicket=await http('/extensions/confirmations',{method:'POST',status:201,body:skillRequest});
  const skillRun=await http('/extensions/runs',{method:'POST',status:202,body:{...skillRequest,confirmationId:skillTicket.confirmationId}});
  const skillDone=await waitFor('skill_run',()=>http(`/extensions/runs/${skillRun.runId}`),(run)=>run.state==='succeeded');
  assert.equal(skillDone.resultSummary.text,'real HTTP');
  assert.equal((await http('/extensions/runs',{method:'POST',status:202,body:{...skillRequest,confirmationId:skillTicket.confirmationId}})).runId,skillRun.runId);
  const skillEvents=await http(`/extensions/runs/${skillRun.runId}/events`);assert.ok(String(skillEvents).includes('extension.run'));
  record('Skill public confirmation and Run',{runId:skillRun.runId,state:skillDone.state,sequence:skillDone.sequence});

  phase='mcp';
  const mcpPreview=await http('/extensions/previews',{method:'POST',body:{requestId:requestId(),kind:'mcp',source:'system:extension_http_mcp'}});
  const mcp=await http('/mcp',{method:'POST',status:202,body:{requestId:requestId(),source:'system:extension_http_mcp',previewId:mcpPreview.previewId,previewDigest:mcpPreview.digest,confirmed:true,config:{transport:'stdio',runnerProfileId:'extension_http'}}});
  const mcpEnabled=await http('/mcp/extension_http_mcp/state',{method:'POST',body:{requestId:requestId(),baseVersion:mcp.stateVersion,desiredState:'enabled'}});
  const connecting=await http('/mcp/extension_http_mcp/connect',{method:'POST',status:202,body:{requestId:requestId(),baseVersion:mcpEnabled.stateVersion}});assert.equal(connecting.connectionState,'connecting');
  await waitFor('mcp_connected',()=>http('/mcp'),(list)=>list.items.some((item)=>item.id==='extension_http_mcp'&&item.connectionState==='connected'));
  const tools=await http('/mcp/extension_http_mcp/tools');assert.ok(tools.items.some((item)=>item.operationId==='echo'));
  const mcpRequest={requestId:requestId(),appId,kind:'mcp',extensionId:'extension_http_mcp',operationId:'echo',extensionVersion:'1.0.0',input:{value:'mcp-http'}};
  const mcpTicket=await http('/extensions/confirmations',{method:'POST',status:201,body:mcpRequest});
  const mcpRun=await http('/extensions/runs',{method:'POST',status:202,body:{...mcpRequest,confirmationId:mcpTicket.confirmationId}});
  const mcpDone=await waitFor('mcp_run',()=>http(`/extensions/runs/${mcpRun.runId}`),(run)=>run.state==='succeeded');assert.equal(mcpDone.resultSummary.value,'mcp-http');
  record('MCP public connect, tools and Run',{runId:mcpRun.runId,state:mcpDone.state,sequence:mcpDone.sequence});

  phase='recovery';
  const originalDaemonPid=daemon.pid;await stopDaemon();daemon=await startDaemon(configPath);assert.notEqual(daemon.pid,originalDaemonPid);
  const recoveredRequest={...mcpRequest,requestId:requestId(),input:{value:'recovered'}};
  const recoveredTicket=await http('/extensions/confirmations',{method:'POST',status:201,body:recoveredRequest});
  const recoveredRun=await http('/extensions/runs',{method:'POST',status:202,body:{...recoveredRequest,confirmationId:recoveredTicket.confirmationId}});
  const recovered=await waitFor('recovered_mcp_run',()=>http(`/extensions/runs/${recoveredRun.runId}`),(run)=>run.state==='succeeded');assert.equal(recovered.resultSummary.value,'recovered');
  const claimed=(await pool.query('SELECT handler_calls FROM extension_runs WHERE run_id=$1',[mcpRun.runId])).rows[0];assert.equal(claimed.handler_calls,1);
  record('Independent daemon process restart recovers MCP',{runId:recoveredRun.runId,state:recovered.state,priorHandlerCalls:claimed.handler_calls,processChanged:true});

  phase='negative_paths';
  await http(`/extensions/runs/${mcpRun.runId}`,{auth:'invalid-session',status:401});
  await http(`/extensions/runs/${mcpRun.runId}`,{auth:randomUUID(),status:401});
  await permission(appId,'mcp.tool.invoke','mcp:extension_http_mcp:echo','deny');
  await http('/extensions/confirmations',{method:'POST',status:403,body:{...mcpRequest,requestId:requestId()}});
  await permission(appId,'mcp.tool.invoke','mcp:extension_http_mcp:echo','allow');
  record('Malformed/unknown session and explicit deny',{malformedSessionRejected:true,unknownSessionRejected:true,permissionDenied:true});

  phase='cancel_and_lifecycle';
  await stopDaemon();
  const cancelRequest={...mcpRequest,requestId:requestId(),input:{value:'cancel-before-claim'}};
  const cancelTicket=await http('/extensions/confirmations',{method:'POST',status:201,body:cancelRequest});
  const pendingRun=await http('/extensions/runs',{method:'POST',status:202,body:{...cancelRequest,confirmationId:cancelTicket.confirmationId}});
  const currentMcp=(await http('/mcp')).items.find((item)=>item.id==='extension_http_mcp');
  await http('/mcp/extension_http_mcp',{method:'DELETE',status:409,body:{requestId:requestId(),baseVersion:currentMcp.stateVersion,confirmed:true}});
  const cancelled=await http(`/extensions/runs/${pendingRun.runId}`,{method:'DELETE',status:202,body:{requestId:requestId()}});
  assert.equal(cancelled.state,'cancelled');
  record('Queued Run cancel and uninstall reference guard',{runId:pendingRun.runId,state:cancelled.state});
  const freshMcp=(await http('/mcp')).items.find((item)=>item.id==='extension_http_mcp');
  const disconnected=await http('/mcp/extension_http_mcp/disconnect',{method:'POST',status:202,body:{requestId:requestId(),baseVersion:freshMcp.stateVersion}});
  daemon=await startDaemon(configPath);
  await waitFor('mcp_stopped',()=>http('/mcp'),(list)=>list.items.some((item)=>item.id==='extension_http_mcp'&&item.connectionState==='stopped'));
  const mcpAfterStop=(await http('/mcp')).items.find((item)=>item.id==='extension_http_mcp');
  const disabledMcp=await http('/mcp/extension_http_mcp/state',{method:'POST',body:{requestId:requestId(),baseVersion:mcpAfterStop.stateVersion,desiredState:'disabled'}});
  const removedMcp=await http('/mcp/extension_http_mcp',{method:'DELETE',status:202,body:{requestId:requestId(),baseVersion:disabledMcp.stateVersion,confirmed:true}});
  const disabledSkill=await http('/skills/text_format/state',{method:'POST',body:{requestId:requestId(),baseVersion:skillEnabled.stateVersion,desiredState:'disabled'}});
  const removedSkill=await http('/skills/text_format',{method:'DELETE',status:202,body:{requestId:requestId(),baseVersion:disabledSkill.stateVersion,confirmed:true}});
  assert.equal(removedMcp.state,'removed');assert.equal(removedSkill.state,'removed');
  record('Disconnect, disable and uninstall',{mcp:removedMcp.state,skill:removedSkill.state});
  await http('/identity/admin/session',{method:'DELETE',status:204});
  await http('/skills',{auth:session,status:401});
  record('Session revocation denies extension read',{revoked:true});
  report.status='passed';
} catch(error){report.status='failed';report.failure={phase,message:error.message};console.error(JSON.stringify(report.failure));process.exitCode=1;}
finally {
  await stopDaemon().catch((error)=>{report.cleanupError=error.message;});
  await api?.close().catch((error)=>{report.cleanupError=error.message;});
  await pool?.end().catch((error)=>{report.cleanupError=error.message;});
  if(created) await admin.query(`DROP DATABASE ${databaseName} WITH (FORCE)`).catch((error)=>{report.cleanupError=`database_cleanup:${databaseName}:${error.message}`;});
  await admin.end().catch((error)=>{report.cleanupError=error.message;});
  if(previousDatabaseUrl===undefined) delete process.env.DGOS_DATABASE_URL; else process.env.DGOS_DATABASE_URL=previousDatabaseUrl;
  await rm(directory,{recursive:true,force:true}).catch((error)=>{report.cleanupError=error.message;});
  if(report.cleanupError){report.status='failed';process.exitCode=1;}
  report.finishedAt=new Date().toISOString();
  const assetSha256=Object.fromEntries(await Promise.all(files.map(async(file)=>[file,createHash('sha256').update(await readFile(file)).digest('hex')])));
  await writeFile(evidencePath,`${JSON.stringify(report,null,2)}\n`,{flag:'wx'});
  await writeFile(manifestPath,`${JSON.stringify({runId,codeVersion:'working-tree',assetSha256,evidencePath,limitations:report.limitations},null,2)}\n`,{flag:'wx'});
  console.log(JSON.stringify({evidencePath,manifestPath,status:report.status}));
}
