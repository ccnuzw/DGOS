import { createHash, randomUUID } from 'node:crypto';
import type { KMSProvider, SecretMetadata, SecretRef } from './kms-provider.ts';
import { SecretNotFoundError } from './kms-provider.ts';

const digest = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

function requireText(value: any, name: string): void {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}

export interface KMSSecretServiceOptions {
  kmsProvider: KMSProvider;
  clock?: () => number;
  handleTtlMs?: number;
  namespace?: string;
}

/**
 * KMS-backed Secret Service
 *
 * Production-ready secret service that uses external KMS for secret storage
 * and encryption, replacing Redis-based in-memory storage.
 */
export class KMSSecretService {
  private kmsProvider: KMSProvider;
  private clock: () => number;
  private handleTtlMs: number;
  private namespace: string;

  constructor({ kmsProvider, clock = () => Date.now(), handleTtlMs = 30_000, namespace = 'dgos' }: KMSSecretServiceOptions) {
    if (!kmsProvider) {
      throw new TypeError('kmsProvider is required');
    }
    if (!Number.isSafeInteger(handleTtlMs) || handleTtlMs <= 0 || handleTtlMs > 60_000) {
      throw new RangeError('handleTtlMs must be between 1 and 60000');
    }
    this.kmsProvider = kmsProvider;
    this.clock = clock;
    this.handleTtlMs = handleTtlMs;
    this.namespace = namespace;
  }

  async init(): Promise<void> {
    await this.kmsProvider.init();
  }

  private secretPath(secretRef: string): string {
    return `${this.namespace}/secrets/${secretRef}`;
  }

  async put({ secretRef, value, purpose, subjectId, ttlMs = 60_000 }: {
    secretRef: string;
    value: string;
    purpose: string;
    subjectId: string;
    ttlMs?: number;
  }): Promise<{ secretRef: string; version: number; credentialState: string }> {
    requireText(secretRef, 'secretRef');
    requireText(value, 'value');
    requireText(purpose, 'purpose');
    requireText(subjectId, 'subjectId');

    if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) {
      throw new RangeError('ttlMs must be a positive safe integer');
    }

    const metadata: SecretMetadata = {
      purpose,
      subjectId,
      ttlSeconds: Math.floor(ttlMs / 1000),
      tags: {
        secretRef,
        digest: digest(value),
      },
    };

    const ref = await this.kmsProvider.storeSecret(
      this.secretPath(secretRef),
      value,
      metadata
    );

    return {
      secretRef,
      version: ref.version || 1,
      credentialState: 'available',
    };
  }

  async resolve({ secretRef, purpose, subjectId }: {
    secretRef: string;
    purpose: string;
    subjectId: string;
  }): Promise<{
    secretRef: string;
    version: number;
    expiresAt: number;
    read: () => Promise<string>;
  }> {
    requireText(secretRef, 'secretRef');
    requireText(purpose, 'purpose');
    requireText(subjectId, 'subjectId');

    const ref: SecretRef = { path: this.secretPath(secretRef) };

    let secretValue;
    try {
      secretValue = await this.kmsProvider.retrieveSecret(ref);
    } catch (error) {
      if (error instanceof SecretNotFoundError) {
        throw new Error('credential_unavailable');
      }
      throw error;
    }

    // Validate scope
    if (secretValue.metadata?.purpose !== purpose || secretValue.metadata?.subjectId !== subjectId) {
      throw new Error('credential_scope_denied');
    }

    // Check expiration
    if (secretValue.expiresAt && secretValue.expiresAt.getTime() <= this.clock()) {
      throw new Error('credential_unavailable');
    }

    const version = secretValue.version;
    const ttl = secretValue.expiresAt ? secretValue.expiresAt.getTime() - this.clock() : this.handleTtlMs;
    const expiresAt = this.clock() + Math.min(ttl, this.handleTtlMs);

    return {
      secretRef,
      version,
      expiresAt,
      read: async () => {
        if (this.clock() >= expiresAt) {
          throw new Error('credential_unavailable');
        }

        // Re-fetch to ensure it's still valid
        const current = await this.kmsProvider.retrieveSecret(ref);

        if (current.version !== version) {
          throw new Error('credential_unavailable');
        }

        if (current.metadata?.purpose !== purpose || current.metadata?.subjectId !== subjectId) {
          throw new Error('credential_scope_denied');
        }

        if (current.expiresAt && current.expiresAt.getTime() <= this.clock()) {
          throw new Error('credential_unavailable');
        }

        return current.value;
      },
    };
  }

  async revoke(secretRef: string): Promise<void> {
    requireText(secretRef, 'secretRef');

    const ref: SecretRef = { path: this.secretPath(secretRef) };

    try {
      await this.kmsProvider.deleteSecret(ref, false);
    } catch (error) {
      if (error instanceof SecretNotFoundError) {
        // Already revoked/deleted, ignore
        return;
      }
      throw error;
    }
  }

  async inspect(secretRef: string): Promise<{
    credentialState: string;
    version?: number;
    digest?: string;
  }> {
    requireText(secretRef, 'secretRef');

    const ref: SecretRef = { path: this.secretPath(secretRef) };

    try {
      const secretValue = await this.kmsProvider.retrieveSecret(ref);

      const isExpired = secretValue.expiresAt && secretValue.expiresAt.getTime() <= this.clock();
      const credentialState = isExpired ? 'unavailable' : 'available';

      return {
        credentialState,
        version: secretValue.version,
        digest: secretValue.metadata?.tags?.digest,
      };
    } catch (error) {
      if (error instanceof SecretNotFoundError) {
        return { credentialState: 'missing' };
      }
      throw error;
    }
  }

  async healthCheck(): Promise<{ available: boolean; latencyMs?: number }> {
    const status = await this.kmsProvider.healthCheck();
    return {
      available: status.available,
      latencyMs: status.latencyMs,
    };
  }

  async close(): Promise<void> {
    await this.kmsProvider.close();
  }
}
