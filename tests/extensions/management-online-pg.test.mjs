import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { generateKeyPairSync,randomUUID,sign } from 'node:crypto';
import { mkdtemp,readFile,rm } from 'node:fs/promises';
import https from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from '../../apps/api/node_modules/pg/lib/index.js';
import { ProviderEgress } from '../../src/security/provider-egress.mjs';
import { ExtensionSourceResolver } from '../../src/extensions/source-resolver.mjs';
import { ExtensionService } from '../../src/extensions/service.mjs';
import { PostgresExtensionRepository } from '../../src/extensions/repository.mjs';
import { PostgresExtensionManagementRepository } from '../../src/extensions/management-repository.mjs';
import { PostgresAuditRepository } from '../../src/audit/outbox.mjs';
import { canonicalJson } from '../../src/apps/package-service.mjs';

const url=process.env.DGOS_EXTENSION_TEST_DATABASE_URL;
test('signed HTTPS preview freezes bytes and rejects mutated or untrusted source',{skip:!url},async()=>{
  if(!/^\/(?:dgos_v1_extensions(?:_[a-z0-9]+)?|dgos_v1_verify_[0-9a-f]{32})$/.test(new URL(url).pathname))throw new Error('test database name mismatch');
  const directory=await mkdtemp(join(tmpdir(),'dgos-extension-online-'));const pool=new pg.Pool({connectionString:url});let server;
  try {
    execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-noenc','-keyout',join(directory,'key.pem'),'-out',join(directory,'cert.pem'),'-days','1','-subj','/CN=extension.test','-addext','subjectAltName=DNS:extension.test'],{stdio:'ignore'});
    const ca=await readFile(join(directory,'cert.pem'));
    const keys=generateKeyPairSync('ed25519');
    const id=`online_${randomUUID().replaceAll('-','')}`;
    const manifest={kind:'skill',id,packageId:`pkg_${id}`,version:'1.0.0',operations:[{operationId:'format',permission:'skill.execute',risk:'low',sideEffects:false,inputSchema:{type:'object',properties:{text:{type:'string'}}}}]};
    const envelope=(body,valid=true)=>({manifest:body,keyId:'fixture',signature:sign(null,Buffer.from(canonicalJson(body)),valid?keys.privateKey:generateKeyPairSync('ed25519').privateKey).toString('base64')});
    let current=envelope(manifest);
    server=https.createServer({key:await readFile(join(directory,'key.pem')),cert:ca},(_request,response)=>{response.setHeader('content-type','application/json');response.end(JSON.stringify(current));});
    await new Promise((resolve)=>server.listen(15149,'127.0.0.1',resolve));
    const egress=new ProviderEgress({allowHosts:['extension.test'],internalHosts:['extension.test'],lookup:async()=>[{address:'127.0.0.1'}],ca});
    const resolver=new ExtensionSourceResolver({onlinePolicy:{allowedHosts:['extension.test'],trustRoots:new Map([['fixture',keys.publicKey]]),request:(input)=>egress.request(input)}});
    const audit=new PostgresAuditRepository(pool);
    const service=new ExtensionService({repository:new PostgresExtensionRepository(pool),managementRepository:new PostgresExtensionManagementRepository(pool,audit),audit,sourceResolver:resolver,permissions:{check:async()=>({decision:'allow'})}});
    const subjectId=randomUUID(),source='https://extension.test:15149/manifest.json';
    const preview=await service.preview({kind:'skill',source,subjectId,requestId:randomUUID()});assert.equal(preview.trustState,'verified');
    current=envelope({...manifest,version:'2.0.0'});
    const installed=await service.install({kind:'skill',source,previewId:preview.previewId,previewDigest:preview.digest,subjectId,requestId:randomUUID(),confirmed:true});
    assert.equal(installed.version,'1.0.0');
    assert.equal((await service.repository.getInstall(subjectId,'skill',id)).manifestDigest,preview.digest);
    current=envelope({...manifest,id:`bad_${id}`},false);
    const rejected=await service.preview({kind:'skill',source,subjectId,requestId:randomUUID()});assert.equal(rejected.trustState,'rejected');
    await assert.rejects(service.install({kind:'skill',source,previewId:rejected.previewId,previewDigest:rejected.digest,subjectId,requestId:randomUUID(),confirmed:true}),/source_untrusted/);
    await assert.rejects(service.preview({kind:'skill',source:`${source}?token=secret`,subjectId,requestId:randomUUID()}),/source_unavailable/);
  } finally {if(server)await new Promise((resolve)=>server.close(resolve));await pool.end();await rm(directory,{recursive:true,force:true});}
});
