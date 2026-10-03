/**
 * KMS Configuration Helper
 *
 * Centralized configuration for KMS provider selection and initialization
 */

import { createKMSProvider, KMSSecretService } from '@dgos/secret-service';

export interface KMSConfig {
  provider: 'dev' | 'vault' | 'aws';
  vaultAddress?: string;
  vaultToken?: string;
  vaultNamespace?: string;
  vaultMountPath?: string;
  vaultAuthMethod?: 'token' | 'approle' | 'kubernetes';
  vaultRoleId?: string;
  vaultSecretId?: string;
  vaultRoleName?: string;
  awsRegion?: string;
  awsKmsKeyId?: string;
}

export function loadKMSConfig(): KMSConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const provider = (process.env.KMS_PROVIDER || 'dev') as 'dev' | 'vault' | 'aws';

  // Enforce production requirements
  if (nodeEnv === 'production' && provider === 'dev') {
    throw new Error(
      'KMS_PROVIDER=dev cannot be used in production. Set KMS_PROVIDER to vault or aws.'
    );
  }

  const config: KMSConfig = {
    provider,
  };

  if (provider === 'vault') {
    config.vaultAddress = process.env.VAULT_ADDR || 'http://localhost:8200';
    config.vaultToken = process.env.VAULT_TOKEN;
    config.vaultNamespace = process.env.VAULT_NAMESPACE;
    config.vaultMountPath = process.env.VAULT_MOUNT_PATH || 'secret/dgos';
    config.vaultAuthMethod = (process.env.VAULT_AUTH_METHOD || 'token') as any;
    config.vaultRoleId = process.env.VAULT_ROLE_ID;
    config.vaultSecretId = process.env.VAULT_SECRET_ID;
    config.vaultRoleName = process.env.VAULT_ROLE_NAME;

    // Validate required fields
    if (config.vaultAuthMethod === 'approle') {
      if (!config.vaultRoleId || !config.vaultSecretId) {
        throw new Error(
          'VAULT_ROLE_ID and VAULT_SECRET_ID are required for AppRole authentication'
        );
      }
    } else if (config.vaultAuthMethod === 'kubernetes') {
      if (!config.vaultRoleName) {
        throw new Error(
          'VAULT_ROLE_NAME is required for Kubernetes authentication'
        );
      }
    } else if (config.vaultAuthMethod === 'token') {
      if (!config.vaultToken) {
        throw new Error('VAULT_TOKEN is required for token authentication');
      }
    }
  } else if (provider === 'aws') {
    config.awsRegion = process.env.AWS_REGION || 'us-west-2';
    config.awsKmsKeyId = process.env.AWS_KMS_KEY_ID;

    if (!config.awsKmsKeyId) {
      throw new Error('AWS_KMS_KEY_ID is required for AWS KMS provider');
    }
  }

  return config;
}

/**
 * Create and initialize KMS Secret Service from environment configuration
 */
export async function createKMSSecretService(): Promise<KMSSecretService> {
  const config = loadKMSConfig();
  const provider = createKMSProvider(config);

  const service = new KMSSecretService({
    kmsProvider: provider,
    namespace: 'dgos',
    handleTtlMs: 30_000,
  });

  await service.init();

  return service;
}

/**
 * Get secret service based on environment configuration
 * Falls back to legacy services if KMS is not configured
 */
export async function getSecretService(options: {
  redis?: any;
  keyProvider?: any;
  preferKMS?: boolean;
} = {}) {
  const { redis, keyProvider, preferKMS = true } = options;

  // Check if KMS is configured
  const kmsProvider = process.env.KMS_PROVIDER;

  if (preferKMS && kmsProvider && kmsProvider !== 'none') {
    try {
      return await createKMSSecretService();
    } catch (error) {
      console.error('Failed to initialize KMS, falling back to legacy:', error);
    }
  }

  // Fallback to legacy services
  const { InMemorySecretService, RedisSecretService, EncryptedRedisSecretService } =
    await import('../../../src/security/secret-service.mjs');

  if (redis && keyProvider) {
    return new EncryptedRedisSecretService(redis, { keyProvider });
  } else if (redis) {
    return new RedisSecretService(redis);
  } else {
    return new InMemorySecretService();
  }
}

export default {
  loadKMSConfig,
  createKMSSecretService,
  getSecretService,
};
