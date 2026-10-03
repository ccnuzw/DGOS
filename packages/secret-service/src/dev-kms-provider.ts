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
  KMSEncryptionError,
  KMSDecryptionError,
  SecretNotFoundError,
} from './kms-provider.ts';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Development KMS Provider
 *
 * In-memory KMS implementation for development and testing.
 * NOT FOR PRODUCTION USE - stores keys and secrets in memory.
 */
export class DevKMSProvider implements KMSProvider {
  private masterKey: Buffer;
  private secrets: Map<string, { data: any; versions: Map<number, any> }> = new Map();
  private initialized: boolean = false;
  private keyId: string = 'dev-master-key';

  constructor(masterKey?: Buffer) {
    this.masterKey = masterKey || randomBytes(32);
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DevKMSProvider cannot be used in production');
    }
  }

  async init(): Promise<void> {
    this.initialized = true;
  }

  async healthCheck(): Promise<KMSHealthStatus> {
    return {
      available: this.initialized,
      latencyMs: 0,
      keyId: this.keyId,
    };
  }

  async encrypt(plaintext: string, context?: EncryptionContext): Promise<EncryptedData> {
    if (!this.initialized) await this.init();

    try {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', this.masterKey, iv);

      if (context) {
        cipher.setAAD(Buffer.from(JSON.stringify(context), 'utf8'));
      }

      const ciphertext = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
      ]);

      const tag = cipher.getAuthTag();

      return {
        ciphertext: ciphertext.toString('base64'),
        keyId: this.keyId,
        algorithm: 'aes-256-gcm',
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        context,
      };
    } catch (error: any) {
      throw new KMSEncryptionError(`Encryption failed: ${error.message}`);
    }
  }

  async decrypt(encrypted: EncryptedData, context?: EncryptionContext): Promise<string> {
    if (!this.initialized) await this.init();

    try {
      if (!encrypted.iv || !encrypted.tag) {
        throw new Error('Missing iv or tag');
      }

      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.masterKey,
        Buffer.from(encrypted.iv, 'base64')
      );

      if (context) {
        decipher.setAAD(Buffer.from(JSON.stringify(context), 'utf8'));
      }

      decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64'));

      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(encrypted.ciphertext, 'base64')),
        decipher.final(),
      ]);

      return plaintext.toString('utf8');
    } catch (error: any) {
      throw new KMSDecryptionError(`Decryption failed: ${error.message}`);
    }
  }

  async generateDataKey(): Promise<DataKey> {
    if (!this.initialized) await this.init();

    const plaintext = randomBytes(32);
    const encrypted = await this.encrypt(plaintext.toString('base64'));

    return {
      plaintext,
      ciphertext: encrypted.ciphertext,
      keyId: this.keyId,
    };
  }

  async storeSecret(key: string, value: string, metadata?: SecretMetadata): Promise<SecretRef> {
    if (!this.initialized) await this.init();

    let secretEntry = this.secrets.get(key);
    if (!secretEntry) {
      secretEntry = { data: {}, versions: new Map() };
      this.secrets.set(key, secretEntry);
    }

    const version = secretEntry.versions.size + 1;
    const now = new Date();

    secretEntry.versions.set(version, {
      value,
      metadata: metadata || {},
      createdAt: now,
      expiresAt: metadata?.ttlSeconds ? new Date(now.getTime() + metadata.ttlSeconds * 1000) : undefined,
    });

    secretEntry.data.currentVersion = version;

    return {
      path: key,
      version,
      keyId: this.keyId,
    };
  }

  async retrieveSecret(ref: SecretRef): Promise<SecretValue> {
    if (!this.initialized) await this.init();

    const secretEntry = this.secrets.get(ref.path);
    if (!secretEntry) {
      throw new SecretNotFoundError(`Secret not found: ${ref.path}`);
    }

    const version = ref.version || secretEntry.data.currentVersion;
    const versionData = secretEntry.versions.get(version);

    if (!versionData) {
      throw new SecretNotFoundError(`Secret version not found: ${ref.path}@${version}`);
    }

    // Check expiration
    if (versionData.expiresAt && versionData.expiresAt < new Date()) {
      throw new SecretNotFoundError(`Secret expired: ${ref.path}`);
    }

    return {
      value: versionData.value,
      version,
      createdAt: versionData.createdAt,
      expiresAt: versionData.expiresAt,
      metadata: versionData.metadata,
    };
  }

  async rotateSecret(ref: SecretRef, newValue?: string): Promise<SecretRef> {
    if (!this.initialized) await this.init();

    const current = await this.retrieveSecret(ref);
    const value = newValue || randomBytes(32).toString('base64url');

    return this.storeSecret(ref.path, value, current.metadata);
  }

  async deleteSecret(ref: SecretRef, hardDelete: boolean = false): Promise<void> {
    if (!this.initialized) await this.init();

    if (hardDelete) {
      this.secrets.delete(ref.path);
    } else {
      const secretEntry = this.secrets.get(ref.path);
      if (secretEntry && ref.version) {
        secretEntry.versions.delete(ref.version);
      }
    }
  }

  async listSecrets(prefix: string = ''): Promise<SecretRef[]> {
    if (!this.initialized) await this.init();

    const results: SecretRef[] = [];

    for (const [path, entry] of this.secrets.entries()) {
      if (!prefix || path.startsWith(prefix)) {
        results.push({
          path,
          version: entry.data.currentVersion,
          keyId: this.keyId,
        });
      }
    }

    return results;
  }

  async close(): Promise<void> {
    this.initialized = false;
    this.secrets.clear();
  }
}
