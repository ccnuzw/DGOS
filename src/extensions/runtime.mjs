import { readFile, realpath } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { ExtensionSourceResolver } from './source-resolver.mjs';
import { invalid, requireId } from './validation.mjs';
import { IsolatedExtensionRunner } from '../../apps/extension-runner/src/runner.mjs';
import { fileURLToPath } from 'node:url';
import { ProviderEgress } from '../security/provider-egress.mjs';

export async function loadExtensionRuntime({ configPath, packageRepository, audit, permissions, secretService, pool, networkRoute, networkFixtureHosts = [] } = {}) {
  if(!configPath||!isAbsolute(configPath)) throw invalid('extension_config_unavailable',503);
  const document=JSON.parse(await readFile(configPath,'utf8'));
  if(document.version!==1||!Array.isArray(document.sources)||!document.sources.length||!document.runnerProfiles||typeof document.runnerProfiles!=='object') throw invalid('extension_config_invalid',503);
  const online=document.onlineSources;
  let onlinePolicy;
  if(online) {
    if(!Array.isArray(online.allowedHosts)||!online.allowedHosts.length||!Array.isArray(online.trustRoots)||!online.trustRoots.length)throw invalid('extension_config_invalid',503);
    const roots=new Map(online.trustRoots.map((root)=>[root.keyId,root.publicKey]));
    const fixtureHosts=networkRoute?.fixtureMode===true?online.allowedHosts.filter((host)=>networkFixtureHosts.includes(host)):[];
    const scopedEgress=new ProviderEgress({allowHosts:online.allowedHosts,internalHosts:fixtureHosts,lookup:fixtureHosts.length?networkRoute.fixtureLookup:undefined,ca:fixtureHosts.length?networkRoute.fixtureCa:undefined});
    const route=networkRoute?networkRoute.forEgress(scopedEgress):scopedEgress;
    onlinePolicy={allowedHosts:online.allowedHosts,trustRoots:roots,request:(input)=>route.request(input)};
  }
  const sourceResolver=new ExtensionSourceResolver({onlinePolicy});
  for(const entry of document.sources) sourceResolver.register(entry.source,{manifest:entry.manifest,trustState:entry.trustState,expectedDigest:entry.digest});
  const runnerProfiles={};
  for(const [id,p] of Object.entries(document.runnerProfiles)) {
    requireId(id);
    if(!isAbsolute(p.command)||!isAbsolute(p.cwd)||!Array.isArray(p.args)||p.args.some((v)=>typeof v!=='string')||p.env&&Object.keys(p.env).length) throw invalid('runner_profile_invalid',503);
    if(Object.entries(p.credentialEnv??{}).some(([field,name])=>!/^[a-z][a-zA-Z0-9_]{0,63}$/.test(field)||!/^[A-Z][A-Z0-9_]{0,63}$/.test(name)||/^(PATH|HOME|LANG|LD_|DYLD_|NODE_)/.test(name))||new Set(Object.values(p.credentialEnv??{})).size!==Object.values(p.credentialEnv??{}).length)throw invalid('runner_profile_invalid',503);
    const command=await realpath(p.command); const cwd=await realpath(p.cwd);
    if(process.env.NODE_ENV!=='test'&&((process.platform==='darwin'&&p.sandbox!=='macos-restricted')||(process.platform==='linux'&&p.sandbox!=='linux-bwrap')||!['darwin','linux'].includes(process.platform))) throw invalid('sandbox_required',503);
    if(p.readOnlyRoots!==undefined&&(!Array.isArray(p.readOnlyRoots)||p.readOnlyRoots.some((root)=>typeof root!=='string')))throw invalid('runner_profile_invalid',503);
    runnerProfiles[id]={command,allowedCommand:command,args:p.args,cwd,allowedCwdRoot:cwd,readOnlyRoots:p.readOnlyRoots??[],timeoutMs:p.timeoutMs??5000,sandbox:p.sandbox,credentialEnv:p.credentialEnv??{}};
  }
  const endpointProfiles={};
  for(const [id,p] of Object.entries(document.endpointProfiles??{})) {
    requireId(id); const url=new URL(p.endpoint);
    if(url.protocol!=='https:'||url.username||url.password||!p.egressPolicyId) throw invalid('endpoint_invalid',503);
    if(Object.entries(p.credentialHeaders??{}).some(([field,binding])=>!/^[a-z][a-zA-Z0-9_]{0,63}$/.test(field)||!binding||typeof binding!=='object'||!['authorization','x-api-key'].includes(binding.name?.toLowerCase())||typeof (binding.prefix??'')!=='string'||(binding.prefix??'').length>32)||new Set(Object.values(p.credentialHeaders??{}).map((binding)=>binding.name.toLowerCase())).size!==Object.values(p.credentialHeaders??{}).length)throw invalid('endpoint_invalid',503);
    const fixtureHost = networkRoute?.fixtureMode === true && networkFixtureHosts.includes(url.hostname.toLowerCase());
    const scopedEgress = new ProviderEgress({allowHosts:[url.hostname.toLowerCase()],internalHosts:fixtureHost?[url.hostname.toLowerCase()]:[],lookup:fixtureHost?networkRoute.fixtureLookup:undefined,ca:fixtureHost?networkRoute.fixtureCa:undefined});
    endpointProfiles[id]={endpoint:url.toString(),egressPolicyId:p.egressPolicyId,egress:networkRoute ? networkRoute.forEgress(scopedEgress) : scopedEgress,credentialHeaders:p.credentialHeaders??{}};
  }
  const runner=new IsolatedExtensionRunner({runnerProfiles,endpointProfiles});
  runner.handlers['skill:text_format:format']={moduleUrl:new URL('./first-party-handler.mjs',import.meta.url).href,exportName:'formatText'};
  runner.allowedModuleRoots=[fileURLToPath(new URL('.',import.meta.url))];
  const appAccess=createDeploymentAppAccess(packageRepository);
  const templates=(document.mcpTemplates??[]).map((item)=>{requireId(item.templateId);if(!sourceResolver.entries.has(item.source)||!Array.isArray(item.credentialFields))throw invalid('extension_config_invalid',503);const profile=item.config?.transport==='stdio'?runnerProfiles[item.config.runnerProfileId]:item.config?.transport==='streamable-http'?endpointProfiles[item.config.endpointRef]:null;if(!profile)throw invalid('extension_config_invalid',503);const fields=new Set(item.credentialFields.map((field)=>field.name));const bindings=profile.credentialEnv??profile.credentialHeaders??{};if(Object.keys(bindings).some((field)=>!fields.has(field)))throw invalid('extension_config_invalid',503);return structuredClone(item);});
  return {sourceResolver,runner,appAccess,audit,permissions,secretService,pool,templates};
}

export async function loadIntoExtensionRuntime({configPath,sourceResolver,runner,networkRoute,networkFixtureHosts}={}) {
  if(!sourceResolver||!runner)throw invalid('extension_runtime_unavailable',503);
  const loaded=await loadExtensionRuntime({configPath,networkRoute,networkFixtureHosts});
  sourceResolver.entries=loaded.sourceResolver.entries;
  sourceResolver.onlinePolicy=loaded.sourceResolver.onlinePolicy;
  runner.runnerProfiles=loaded.runner.runnerProfiles;
  runner.endpointProfiles=loaded.runner.endpointProfiles;
  runner.handlers=loaded.runner.handlers;
  runner.allowedModuleRoots=loaded.runner.allowedModuleRoots;
  return {sourceResolver,runner,templates:loaded.templates};
}

export function createDeploymentAppAccess(packageRepository) {
  return async ({subjectId,appId,kind,extensionId,extensionVersion,packageId,operationId,capability})=>{
    if(!packageRepository?.getDeployment||!packageRepository?.getPackageById)return false;
    const deployment=await packageRepository.getDeployment(subjectId,appId);
    if(deployment?.state!=='active')return false;
    const release=await packageRepository.getPackageById(deployment.packageId);
    if(!release||release.digest!==deployment.digest||!['approved','official'].includes(release.catalogState))return false;
    const manifest=release.manifest;
    if(!manifest?.capabilityAllowlist?.includes(capability)||!manifest?.permissions?.includes(capability))return false;
    const deps=manifest.dependencies;
    const references=kind==='mcp'?deps?.mcp:deps?.skills;
    if(!Array.isArray(references))return false;
    return references.some((ref)=>ref&&typeof ref==='object'&&ref.version===extensionVersion&&Array.isArray(ref.operationIds)&&ref.operationIds.includes(operationId)&&(kind==='mcp'?ref.sourceId===extensionId:ref.packageId===packageId&&ref.skillId===extensionId));
  };
}
