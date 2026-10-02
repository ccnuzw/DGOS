const invalid = () => Object.assign(new Error('proxy_configuration_invalid'), { errorKey: 'proxy_configuration_invalid' });

// Only the reference is deployment configuration. Proxy URL and auth remain in Secret Service.
export function createSystemProxyProvider({ env = process.env, secretService } = {}) {
  const ref = env.DGOS_SYSTEM_PROXY_SECRET_REF;
  if (ref === undefined || ref === '') return async () => null;
  if (typeof ref !== 'string' || !/^[a-zA-Z0-9._-]{1,256}$/.test(ref) || !secretService?.resolve) throw invalid();
  return async () => {
    const handle = await secretService.resolve({ secretRef: ref, purpose: 'network-proxy', subjectId: 'system' });
    try { return { ...JSON.parse(await handle.read()), credentialVersion: handle.version }; }
    catch { throw Object.assign(new Error('credential_unavailable'), { errorKey: 'credential_unavailable' }); }
  };
}
