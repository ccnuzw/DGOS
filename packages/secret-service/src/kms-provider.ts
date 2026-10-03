/**
 * KMS Provider Interface - Production-grade secret management abstraction
 *
 * Provides a unified interface for external Key Management Services (KMS)
 * to replace in-memory and Redis-based secret storage.
 */

export interface EncryptionContext {
  purpose?: string;
  subjectId?: string;
  version?: number;
  [key: string]: string | number | undefined;
}

export interface EncryptedData {
  ciphertext: string;
  keyId: string;
  algorithm: string;
  iv?: string;
  tag?: string;
  context?: EncryptionContext;
}

export interface DataKey {
  plaintext: Buffer;
  ciphertext: string;
  keyId: string;
}

export interface SecretMetadata {
  purpose?: string;
  subjectId?: string;
  ttlSeconds?: number;
  tags?: Record<string, string>;
  description?: string;
}

export interface SecretRef {
  path: string;
  version?: number;
  keyId?: string;
}

export interface SecretValue {
  value: string;
  version: number;
  createdAt: Date;
  expiresAt?: Date;
  metadata?: SecretMetadata;
}

export interface KMSHealthStatus {
  available: boolean;
  latencyMs?: number;
  error?: string;
  keyId?: string;
}

/**
 * KMS Provider Interface
 *
 * All KMS implementations must implement this interface to ensure
 * compatibility across different secret backends (Vault, AWS, GCP, etc.)
 */
export interface KMSProvider {
  /**
   * Initialize the KMS provider (authentication, connection setup)
   */
  init(): Promise<void>;

  /**
   * Check health and availability of the KMS service
   */
  healthCheck(): Promise<KMSHealthStatus>;

  /**
   * Encrypt plaintext data using the KMS
   */
  encrypt(plaintext: string, context?: EncryptionContext): Promise<EncryptedData>;

  /**
   * Decrypt ciphertext using the KMS
   */
  decrypt(encrypted: EncryptedData, context?: EncryptionContext): Promise<string>;

  /**
   * Generate a data encryption key (DEK) for envelope encryption
   */
  generateDataKey(): Promise<DataKey>;

  /**
   * Store a secret in the KMS secret store
   */
  storeSecret(key: string, value: string, metadata?: SecretMetadata): Promise<SecretRef>;

  /**
   * Retrieve a secret from the KMS secret store
   */
  retrieveSecret(ref: SecretRef): Promise<SecretValue>;

  /**
   * Rotate a secret to a new value/version
   */
  rotateSecret(ref: SecretRef, newValue?: string): Promise<SecretRef>;

  /**
   * Delete a secret (soft delete with grace period by default)
   */
  deleteSecret(ref: SecretRef, hardDelete?: boolean): Promise<void>;

  /**
   * List all secrets (for migration/auditing)
   */
  listSecrets(prefix?: string): Promise<SecretRef[]>;

  /**
   * Close connections and cleanup resources
   */
  close(): Promise<void>;
}

/**
 * Base KMS Provider Error
 */
export class KMSError extends Error {
  constructor(message: string, public code: string, public statusCode: number = 500) {
    super(message);
    this.name = 'KMSError';
  }
}

export class KMSUnavailableError extends KMSError {
  constructor(message: string = 'KMS service unavailable') {
    super(message, 'kms_unavailable', 503);
  }
}

export class KMSAuthenticationError extends KMSError {
  constructor(message: string = 'KMS authentication failed') {
    super(message, 'kms_auth_failed', 401);
  }
}

export class KMSEncryptionError extends KMSError {
  constructor(message: string = 'Encryption operation failed') {
    super(message, 'kms_encryption_failed', 500);
  }
}

export class KMSDecryptionError extends KMSError {
  constructor(message: string = 'Decryption operation failed') {
    super(message, 'kms_decryption_failed', 500);
  }
}

export class SecretNotFoundError extends KMSError {
  constructor(message: string = 'Secret not found') {
    super(message, 'secret_not_found', 404);
  }
}

export class SecretVersionConflictError extends KMSError {
  constructor(message: string = 'Secret version conflict') {
    super(message, 'secret_version_conflict', 409);
  }
}
