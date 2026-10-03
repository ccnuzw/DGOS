// KMS Provider Interface and Types
export type {
  KMSProvider,
  EncryptionContext,
  EncryptedData,
  DataKey,
  SecretMetadata,
  SecretRef,
  SecretValue,
  KMSHealthStatus,
} from './kms-provider.ts';

export {
  KMSError,
  KMSUnavailableError,
  KMSAuthenticationError,
  KMSEncryptionError,
  KMSDecryptionError,
  SecretNotFoundError,
  SecretVersionConflictError,
} from './kms-provider.ts';

// Vault KMS Provider
export type { VaultConfig, VaultTransitKeyConfig } from './vault-client.ts';
export { VaultKMSProvider } from './vault-client.ts';

// Development KMS Provider
export { DevKMSProvider } from './dev-kms-provider.ts';

// KMS-backed Secret Service
export type { KMSSecretServiceOptions } from './kms-secret-service.ts';
export { KMSSecretService } from './kms-secret-service.ts';

// Factory function for creating KMS provider based on environment
export function createKMSProvider(config?: any): any {
  const provider = config?.provider || process.env.KMS_PROVIDER || 'dev';

  switch (provider) {
    case 'vault':
      return new (require('./vault-client.ts').VaultKMSProvider)({
        address: config?.vaultAddress || process.env.VAULT_ADDR || 'http://localhost:8200',
        token: config?.vaultToken || process.env.VAULT_TOKEN,
        namespace: config?.vaultNamespace || process.env.VAULT_NAMESPACE,
        mountPath: config?.mountPath || process.env.VAULT_MOUNT_PATH || 'secret/dgos',
        authMethod: config?.authMethod || process.env.VAULT_AUTH_METHOD || 'token',
        roleId: config?.roleId || process.env.VAULT_ROLE_ID,
        secretId: config?.secretId || process.env.VAULT_SECRET_ID,
        roleName: config?.roleName || process.env.VAULT_ROLE_NAME,
      });

    case 'dev':
      if (process.env.NODE_ENV === 'production') {
        throw new Error('DevKMSProvider cannot be used in production. Set KMS_PROVIDER to vault or aws.');
      }
      return new (require('./dev-kms-provider.ts').DevKMSProvider)();

    default:
      throw new Error(`Unsupported KMS provider: ${provider}`);
  }
}
