import { createPublicKey, verify } from 'node:crypto';
import { digest, invalid, validateManifest } from './validation.mjs';
import { canonicalJson } from '../apps/package-service.mjs';

// A deployment registers inspected packages. Source strings are lookup keys,
// never URLs to fetch or commands to execute during preview/install.
export class ExtensionSourceResolver {
  constructor({ entries = {}, onlinePolicy } = {}) { this.entries = new Map(Object.entries(entries)); this.onlinePolicy=onlinePolicy; }
  register(source, { manifest, trustState = 'untrusted', expectedDigest } = {}) {
    if (!/^(registry|bundled|system|local):[a-z0-9_./-]{1,256}$/.test(source) || source.includes('..')) throw invalid();
    validateManifest(manifest, manifest.kind);
    const actual = digest(manifest);
    if (expectedDigest && expectedDigest !== actual) throw invalid('source_digest_mismatch', 422);
    this.entries.set(source, { manifest: structuredClone(manifest), trustState, digest: actual });
  }
  async resolve({ kind, source }) {
    if(source.startsWith('https://'))return this.resolveOnline({kind,source});
    const entry = this.entries.get(source); if (!entry || entry.manifest.kind !== kind) throw invalid('source_unavailable', 404); return structuredClone(entry);
  }
  async resolveOnline({kind,source}) {
    const policy=this.onlinePolicy;if(!policy?.request||!policy?.allowedHosts?.length||!policy?.trustRoots)throw invalid('source_unavailable',404);
    let url;try{url=new URL(source);}catch{throw invalid();}
    if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||!policy.allowedHosts.includes(url.hostname.toLowerCase()))throw invalid('source_unavailable',404);
    const response=await policy.request({url:url.toString(),method:'GET',timeoutMs:8000,maxResponseBytes:262144});
    if(!response.ok)throw invalid('source_unavailable',502);
    const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>262144)throw invalid('source_too_large',413);
    let envelope;try{envelope=JSON.parse(bytes.toString('utf8'));}catch{throw invalid('source_invalid',422);}
    if(!envelope||typeof envelope!=='object'||!envelope.manifest||typeof envelope.keyId!=='string'||typeof envelope.signature!=='string')throw invalid('source_invalid',422);
    const canonical=canonicalJson(envelope.manifest);const root=policy.trustRoots.get(envelope.keyId);
    const trusted=Boolean(root&&verify(null,Buffer.from(canonical),root.type==='public'?root:createPublicKey(root),Buffer.from(envelope.signature,'base64')));
    validateManifest(envelope.manifest,kind);
    return {manifest:structuredClone(envelope.manifest),trustState:trusted?'trusted':'untrusted',digest:digest(envelope.manifest),sourceDigest:digest(bytes.toString('base64')),envelope:{...envelope,_rawBytes:bytes.toString('base64')}};
  }
}
