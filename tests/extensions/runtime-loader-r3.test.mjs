import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadExtensionRuntime, loadIntoExtensionRuntime } from '../../src/extensions/runtime.mjs';
import { ExtensionSourceResolver } from '../../src/extensions/source-resolver.mjs';
import { IsolatedExtensionRunner } from '../../apps/extension-runner/src/runner.mjs';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ExtensionService } from '../../src/extensions/service.mjs';
import { InMemoryExtensionRepository } from '../../src/extensions/repository.mjs';

test('deployment loader supplies trusted first-party source and controlled handler',async()=>{
  const configPath=fileURLToPath(new URL('../../src/extensions/v1-default-runtime.json',import.meta.url));
  const sourceResolver=new ExtensionSourceResolver(); const runner=new IsolatedExtensionRunner();
  await loadIntoExtensionRuntime({configPath,sourceResolver,runner});
  const source=await sourceResolver.resolve({kind:'skill',source:'system:dgos_text_format'});
  assert.equal(source.trustState,'trusted');
  assert.deepEqual(await runner.invoke({kind:'skill',extensionId:'text_format',operationId:'format',input:{text:'  hello   DGOS  '}}),{text:'hello DGOS'});
  const worker=await loadExtensionRuntime({configPath});
  assert.equal((await worker.sourceResolver.resolve({kind:'skill',source:'system:dgos_text_format'})).manifest.id,'text_format');
});

test('quick MCP config loads server-owned profile and completes a real tool call',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'dgos-mcp-quick-'));
  const fixture=fileURLToPath(new URL('./stdio-mcp-fixture.mjs',import.meta.url));
  const configPath=join(directory,'runtime.json');
  const document={version:1,sources:[{source:'system:quick_echo',trustState:'trusted',manifest:{kind:'mcp',id:'quick_echo',version:'1.0.0',operations:[{operationId:'echo',permission:'mcp.tool.invoke',risk:'low',sideEffects:false,inputSchema:{type:'object',required:['value'],properties:{value:{type:'string'}}}}]}}],runnerProfiles:{quick_echo:{command:process.execPath,cwd:fileURLToPath(new URL('.',import.meta.url)),args:[fixture],sandbox:process.platform==='darwin'?'macos-restricted':'linux-bwrap',timeoutMs:2000}},endpointProfiles:{}};
  try {
    await writeFile(configPath,JSON.stringify(document));
    const runtime=await loadExtensionRuntime({configPath});
    const service=new ExtensionService({repository:new InMemoryExtensionRepository(),sourceResolver:runtime.sourceResolver,runner:runtime.runner,permissions:{check:async()=>({decision:'allow'})},audit:{record:async()=>{}},appAccess:async()=>true,verifyConfirmation:async()=>true});
    const subjectId=randomUUID(); const source='system:quick_echo';
    const preview=await service.preview({kind:'mcp',source,subjectId,requestId:randomUUID()});
    const installed=await service.install({kind:'mcp',source,previewId:preview.previewId,previewDigest:preview.digest,subjectId,confirmed:true,requestId:randomUUID(),config:{transport:'stdio',runnerProfileId:'quick_echo'}});
    const enabled=await service.setState({kind:'mcp',id:'quick_echo',subjectId,desiredState:'enabled',baseVersion:installed.stateVersion,requestId:randomUUID()});
    assert.equal((await service.connect({id:'quick_echo',subjectId,baseVersion:enabled.stateVersion,requestId:randomUUID(),confirmed:true})).connectionState,'connecting');
    await service.processConnectionIntents();
    const current=await service.repository.getInstall(subjectId,'mcp','quick_echo'); assert.equal(current.connectionState,'connected');
    const requestId=randomUUID(); const run=await service.submit({kind:'mcp',id:'quick_echo',operationId:'echo',extensionVersion:'1.0.0',input:{value:'quick'},subjectId,appId:'fixture',requestId,confirmationId:'fixture'});
    await service.process(run.runId); assert.equal((await service.getRun({runId:run.runId,subjectId})).resultSummary.value,'quick');
    await runtime.runner.close();
  } finally { await rm(directory,{recursive:true,force:true}); }
});
