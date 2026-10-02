import { createHmac, randomBytes } from 'node:crypto';

const secretRef='dgos:extension-management:credential-fingerprint:v1';
const purpose='extension-credential-fingerprint';
const subjectId='system';

export async function createExtensionCredentialFingerprint({pool,secretService}) {
  if(!pool?.connect||!secretService?.put||!secretService?.resolve||!secretService?.inspect)throw new Error('extension_credential_fingerprint_unavailable');
  const client=await pool.connect();
  let key;
  try {
    await client.query('SELECT pg_advisory_lock(hashtext($1))',[secretRef]);
    const status=await secretService.inspect(secretRef);
    if(status.credentialState==='missing')await secretService.put({secretRef,value:randomBytes(32).toString('base64'),purpose,subjectId,ttlMs:10*365*24*60*60*1000});
    const handle=await secretService.resolve({secretRef,purpose,subjectId});
    if(handle.version!==1)throw new Error('extension_credential_fingerprint_version_conflict');
    key=Buffer.from(await handle.read(),'base64');
    if(key.length!==32)throw new Error('extension_credential_fingerprint_invalid');
  } finally {
    try {await client.query('SELECT pg_advisory_unlock(hashtext($1))',[secretRef]);}finally{client.release();}
  }
  return (credentials)=>{
    if(!credentials||typeof credentials!=='object'||Array.isArray(credentials))throw new TypeError('extension_credentials_invalid');
    const entries=Object.entries(credentials).sort(([a],[b])=>a.localeCompare(b,'en'));
    return {digest:createHmac('sha256',key).update(JSON.stringify(entries)).digest('hex'),keyVersion:1};
  };
}
