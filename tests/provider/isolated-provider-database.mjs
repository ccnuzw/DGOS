export function isIsolatedProviderDatabase(connectionString) {
  if (!connectionString) return false;
  try {
    const database = new URL(connectionString).pathname.slice(1);
    return /^(?:dgos_v1_provider|dgos_v1_verify_[0-9a-f]{32})$/.test(database);
  } catch { return false; }
}
