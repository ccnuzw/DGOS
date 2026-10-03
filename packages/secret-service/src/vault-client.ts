import vault from 'node-vault';
import type {
  KMSProvider,
  EncryptionContext,
  EncryptedData,
  DataKey,
  SecretMetadata,
  SecretRef,
  SecretValue,
  KMSHealthStatus,
} from './kms-provider.ts';
import {
  KMSUnavailableError,
  KMSAuthenticationError,
  KMSEncryptionError,
  KMSDecryptionError,
  SecretNotFoundError,
  SecretVersionConflictError,
} from './kms-provider.ts';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';

export interface VaultConfig {
  address: string;
  token?: string;
  namespace?: string;
  mountPath?: string;
  authMethod?: 'token' | 'approle' | 'kubernetes';
  roleId?: string;
  secretId?: string;
  roleName?: string;
  transitMountPath?: string;
  kvMountPath?: string;
  requestTimeout?: number;
}

export interface VaultTransitKeyConfig {
  name: string;
  type?: 'aes256-gcm96' | 'chacha20-poly1305' | 'rsa-2048' | 'rsa-4096';
  convergentEncryption?: boolean;
  derived?: boolean;
}

/**
 * HashiCorp Vault KMS Provider
 *
 * Implements KMSProvider interface using Vault's Transit secrets engine
 * for encryption and KV v2 secrets engine for secret storage.
 */
export class VaultKMSProvider implements KMSProvider {
  private client: any;
  private config: VaultConfig;
  private initialized: boolean = false;
  private transitMountPath: string;
  private kvMountPath: string;
  private transitKeyName: string = 'dgos-master';

  constructor(config: VaultConfig) {
    this.config = {
      requestTimeout: 30000,
      transitMountPath: 'transit',
      kvMountPath: 'secret',
      mountPath: 'secret/dgos',
      ...config,
    };
    this.transitMountPath = this.config.transitMountPath!;
    this.kvMountPath = this.config.kvMountPath!;
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      // Create Vault client
      this.client = vault({
        apiVersion: 'v1',
        endpoint: this.config.address,
        token: this.config.token,
        namespace: this.config.namespace,
        requestOptions: {
          timeout: this.config.requestTimeout,
        },
      });

      // Authenticate based on auth method
      if (this.config.authMethod === 'approle' && this.config.roleId && this.config.secretId) {
        const result = await this.client.approleLogin({
          role_id: this.config.roleId,
          secret_id: this.config.secretId,
        });
        this.client.token = result.auth.client_token;
      } else if (this.config.authMethod === 'kubernetes' && this.config.roleName) {
        // Read service account token
        const { readFile } = await import('node:fs/promises');
        const jwt = await readFile('/var/run/secrets/kubernetes.io/serviceaccount/token', 'utf8');
        const result = await this.client.kubernetesLogin({
          role: this.config.roleName,
          jwt: jwt.trim(),
        });
        this.client.token = result.auth.client_token;
      }

      // Verify connection and ensure transit key exists
      await this.ensureTransitKey();
      this.initialized = true;
    } catch (error: any) {
      if (error.response?.statusCode === 403) {
        throw new KMSAuthenticationError(`Vault authentication failed: ${error.message}`);
      }
      throw new KMSUnavailableError(`Failed to initialize Vault: ${error.message}`);
    }
  }

  private async ensureTransitKey(): Promise<void> {
    try {
      // Try to read the key
      await this.client.read(`${this.transitMountPath}/keys/${this.transitKeyName}`);
    } catch (error: any) {
      if (error.response?.statusCode === 404) {
        // Key doesn't exist, create it
        await this.client.write(`${this.transitMountPath}/keys/${this.transitKeyName}`, {
          type: 'aes256-gcm96',
          convergent_encryption: false,
          derived: false,
          exportable: false,
          allow_plaintext_backup: false,
        });
      } else {
        throw error;
      }
    }
  }

  async healthCheck(): Promise<KMSHealthStatus> {
    const startTime = Date.now();
    try {
      await this.client.health();
      const latencyMs = Date.now() - startTime;
      return {
        available: true,
        latencyMs,
        keyId: this.transitKeyName,
      };
    } catch (error: any) {
      return {
        available: false,
        error: error.message,
      };
    }
  }

  async encrypt(plaintext: string, context?: EncryptionContext): Promise<EncryptedData> {
    if (!this.initialized) await this.init();

    try {
      const contextData = context ? this.encodeContext(context) : undefined;
      const result = await this.client.write(`${this.transitMountPath}/encrypt/${this.transitKeyName}`, {
        plaintext: Buffer.from(plaintext, 'utf8').toString('base64'),
        context: contextData,
      });

      return {
        ciphertext: result.data.ciphertext,
        keyId: this.transitKeyName,
        algorithm: 'aes256-gcm96',
        context,
      };
    } catch (error: any) {
      throw new KMSEncryptionError(`Vault encryption failed: ${error.message}`);
    }
  }

  async decrypt(encrypted: EncryptedData, context?: EncryptionContext): Promise<string> {
    if (!this.initialized) await this.init();

    try {
      const contextData = context ? this.encodeContext(context) : undefined;
      const result = await this.client.write(`${this.transitMountPath}/decrypt/${this.transitKeyName}`, {
        ciphertext: encrypted.ciphertext,
        context: contextData,
      });

      return Buffer.from(result.data.plaintext, 'base64').toString('utf8');
    } catch (error: any) {
      throw new KMSDecryptionError(`Vault decryption failed: ${error.message}`);
    }
  }

  async generateDataKey(): Promise<DataKey> {
    if (!this.initialized) await this.init();

    try {
      const result = await this.client.write(`${this.transitMountPath}/datakey/plaintext/${this.transitKeyName}`, {
        bits: 256,
      });

      return {
        plaintext: Buffer.from(result.data.plaintext, 'base64'),
        ciphertext: result.data.ciphertext,
        keyId: this.transitKeyName,
      };
    } catch (error: any) {
      throw new KMSEncryptionError(`Failed to generate data key: ${error.message}`);
    }
  }

  async storeSecret(key: string, value: string, metadata?: SecretMetadata): Promise<SecretRef> {
    if (!this.initialized) await this.init();

    try {
      const path = this.normalizeSecretPath(key);
      const data: any = {
        value,
        created_at: new Date().toISOString(),
      };

      if (metadata) {
        if (metadata.purpose) data.purpose = metadata.purpose;
        if (metadata.subjectId) data.subject_id = metadata.subjectId;
        if (metadata.description) data.description = metadata.description;
        if (metadata.tags) data.tags = metadata.tags;
        if (metadata.ttlSeconds) data.ttl_seconds = metadata.ttlSeconds;
        if (metadata.ttlSeconds) data.expires_at = new Date(Date.now() + metadata.ttlSeconds * 1000).toISOString();
      }

      // KV v2 stores secrets at data/<path>
      const result = await this.client.write(`${this.kvMountPath}/data/${path}`, {
        data,
        options: metadata?.ttlSeconds ? { ttl: `${metadata.ttlSeconds}s` } : undefined,
      });

      return {
        path,
        version: result.data.version,
        keyId: this.transitKeyName,
      };
    } catch (error: any) {
      throw new KMSUnavailableError(`Failed to store secret: ${error.message}`);
    }
  }

  async retrieveSecret(ref: SecretRef): Promise<SecretValue> {
    if (!this.initialized) await this.init();

    try {
      const path = ref.version
        ? `${this.kvMountPath}/data/${ref.path}?version=${ref.version}`
        : `${this.kvMountPath}/data/${ref.path}`;

      const result = await this.client.read(path);

      if (!result?.data?.data) {
        throw new SecretNotFoundError(`Secret not found at path: ${ref.path}`);
      }

      const secretData = result.data.data;
      const metadata = result.data.metadata;

      return {
        value: secretData.value,
        version: metadata.version,
        createdAt: new Date(metadata.created_time),
        expiresAt: secretData.expires_at ? new Date(secretData.expires_at) : undefined,
        metadata: {
          purpose: secretData.purpose,
          subjectId: secretData.subject_id,
          description: secretData.description,
          tags: secretData.tags,
        },
      };
    } catch (error: any) {
      if (error.response?.statusCode === 404) {
        throw new SecretNotFoundError(`Secret not found at path: ${ref.path}`);
      }
      throw new KMSUnavailableError(`Failed to retrieve secret: ${error.message}`);
    }
  }

  async rotateSecret(ref: SecretRef, newValue?: string): Promise<SecretRef> {
    if (!this.initialized) await this.init();

    try {
      // Get current secret to preserve metadata
      const current = await this.retrieveSecret(ref);

      // If no new value provided, generate one
      const value = newValue || this.generateSecretValue();

      // Store new version
      const data: any = {
        value,
        created_at: new Date().toISOString(),
        rotated_from_version: current.version,
      };

      if (current.metadata) {
        if (current.metadata.purpose) data.purpose = current.metadata.purpose;
        if (current.metadata.subjectId) data.subject_id = current.metadata.subjectId;
        if (current.metadata.description) data.description = current.metadata.description;
        if (current.metadata.tags) data.tags = current.metadata.tags;
        if (current.metadata.ttlSeconds) {
          data.ttl_seconds = current.metadata.ttlSeconds;
          data.expires_at = new Date(Date.now() + current.metadata.ttlSeconds * 1000).toISOString();
        }
      }

      const result = await this.client.write(`${this.kvMountPath}/data/${ref.path}`, {
        data,
        options: {
          cas: current.version, // Check-and-set for optimistic locking
        },
      });

      return {
        path: ref.path,
        version: result.data.version,
        keyId: this.transitKeyName,
      };
    } catch (error: any) {
      if (error.response?.statusCode === 409) {
        throw new SecretVersionConflictError(`Secret was modified: ${ref.path}`);
      }
      throw new KMSUnavailableError(`Failed to rotate secret: ${error.message}`);
    }
  }

  async deleteSecret(ref: SecretRef, hardDelete: boolean = false): Promise<void> {
    if (!this.initialized) await this.init();

    try {
      if (hardDelete) {
        // Permanently delete all versions
        await this.client.delete(`${this.kvMountPath}/metadata/${ref.path}`);
      } else {
        // Soft delete (mark as deleted, can be undeleted)
        const versions = ref.version ? [ref.version] : await this.getAllVersions(ref.path);
        await this.client.write(`${this.kvMountPath}/delete/${ref.path}`, {
          versions,
        });
      }
    } catch (error: any) {
      if (error.response?.statusCode === 404) {
        // Already deleted, ignore
        return;
      }
      throw new KMSUnavailableError(`Failed to delete secret: ${error.message}`);
    }
  }

  async listSecrets(prefix: string = ''): Promise<SecretRef[]> {
    if (!this.initialized) await this.init();

    try {
      const path = prefix ? `${this.kvMountPath}/metadata/${prefix}` : `${this.kvMountPath}/metadata`;
      const result = await this.client.list(path);

      if (!result?.data?.keys) {
        return [];
      }

      return result.data.keys.map((key: string) => ({
        path: prefix ? `${prefix}/${key}` : key,
        keyId: this.transitKeyName,
      }));
    } catch (error: any) {
      if (error.response?.statusCode === 404) {
        return [];
      }
      throw new KMSUnavailableError(`Failed to list secrets: ${error.message}`);
    }
  }

  async close(): Promise<void> {
    this.initialized = false;
    this.client = null;
  }

  // Helper methods

  private normalizeSecretPath(key: string): string {
    const mountPath = this.config.mountPath || 'dgos';
    // Remove leading/trailing slashes and normalize
    const normalizedKey = key.replace(/^\/+|\/+$/g, '');
    const normalizedMount = mountPath.replace(/^\/+|\/+$/g, '');
    return `${normalizedMount}/${normalizedKey}`;
  }

  private encodeContext(context: EncryptionContext): string {
    // Vault expects context as base64-encoded string
    return Buffer.from(JSON.stringify(context), 'utf8').toString('base64');
  }

  private generateSecretValue(): string {
    // Generate a secure random value for key rotation
    return randomBytes(32).toString('base64url');
  }

  private async getAllVersions(path: string): Promise<number[]> {
    try {
      const result = await this.client.read(`${this.kvMountPath}/metadata/${path}`);
      return Object.keys(result.data.versions).map(Number);
    } catch {
      return [];
    }
  }
}
