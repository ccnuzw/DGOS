# @dgos/secret-service

Production-grade secret management with external KMS integration for DGOS.

## Overview

This package provides a unified interface for managing secrets across different Key Management Service (KMS) backends. It replaces in-memory and Redis-based secret storage with production-ready external KMS solutions.

## Features

- 🔐 **Multiple KMS Backends:** Vault, AWS KMS (future), GCP Secret Manager (future)
- 🔄 **Secret Versioning:** Track and rollback secret versions
- 🔃 **Secret Rotation:** Automated secret rotation support
- 🛡️ **Encryption:** Transit encryption for data protection
- 📊 **Health Monitoring:** Built-in health checks and metrics
- 🔍 **Audit Logging:** Comprehensive audit trail
- ⚡ **Performance:** Optimized for low latency
- 🧪 **Testing:** Development provider for testing

## Installation

```bash
pnpm add @dgos/secret-service
```

## Quick Start

### Development

```typescript
import { DevKMSProvider, KMSSecretService } from '@dgos/secret-service';

// Create dev provider (in-memory, for testing only)
const provider = new DevKMSProvider();
await provider.init();

// Create secret service
const secretService = new KMSSecretService({ kmsProvider: provider });
await secretService.init();

// Store a secret
await secretService.put({
  secretRef: 'my-secret',
  value: 'secret-value',
  purpose: 'api-key',
  subjectId: 'user-123',
  ttlMs: 3600000, // 1 hour
});

// Retrieve secret
const handle = await secretService.resolve({
  secretRef: 'my-secret',
  purpose: 'api-key',
  subjectId: 'user-123',
});

const value = await handle.read();
console.log(value); // 'secret-value'
```

### Production (Vault)

```typescript
import { VaultKMSProvider, KMSSecretService } from '@dgos/secret-service';

// Create Vault provider
const provider = new VaultKMSProvider({
  address: process.env.VAULT_ADDR,
  authMethod: 'approle',
  roleId: process.env.VAULT_ROLE_ID,
  secretId: process.env.VAULT_SECRET_ID,
  mountPath: 'secret/dgos',
});

await provider.init();

const secretService = new KMSSecretService({ kmsProvider: provider });
await secretService.init();

// Use same API as dev
```

### Using Factory

```typescript
import { createKMSProvider, KMSSecretService } from '@dgos/secret-service';

// Automatically selects provider based on KMS_PROVIDER env var
const provider = createKMSProvider();
await provider.init();

const secretService = new KMSSecretService({ kmsProvider: provider });
await secretService.init();
```

## API Reference

### KMSProvider Interface

All KMS providers implement this interface:

```typescript
interface KMSProvider {
  // Initialize the provider
  init(): Promise<void>;

  // Check health
  healthCheck(): Promise<KMSHealthStatus>;

  // Encrypt/decrypt data
  encrypt(plaintext: string, context?: EncryptionContext): Promise<EncryptedData>;
  decrypt(encrypted: EncryptedData, context?: EncryptionContext): Promise<string>;

  // Generate data encryption key
  generateDataKey(): Promise<DataKey>;

  // Store/retrieve secrets
  storeSecret(key: string, value: string, metadata?: SecretMetadata): Promise<SecretRef>;
  retrieveSecret(ref: SecretRef): Promise<SecretValue>;

  // Rotate/delete secrets
  rotateSecret(ref: SecretRef, newValue?: string): Promise<SecretRef>;
  deleteSecret(ref: SecretRef, hardDelete?: boolean): Promise<void>;

  // List secrets
  listSecrets(prefix?: string): Promise<SecretRef[]>;

  // Cleanup
  close(): Promise<void>;
}
```

### KMSSecretService

Compatible with existing DGOS SecretService interface:

```typescript
class KMSSecretService {
  // Store a secret
  async put(options: {
    secretRef: string;
    value: string;
    purpose: string;
    subjectId: string;
    ttlMs?: number;
  }): Promise<{ secretRef: string; version: number; credentialState: string }>;

  // Resolve secret to a handle
  async resolve(options: {
    secretRef: string;
    purpose: string;
    subjectId: string;
  }): Promise<{
    secretRef: string;
    version: number;
    expiresAt: number;
    read: () => Promise<string>;
  }>;

  // Revoke a secret
  async revoke(secretRef: string): Promise<void>;

  // Inspect secret state
  async inspect(secretRef: string): Promise<{
    credentialState: string;
    version?: number;
    digest?: string;
  }>;

  // Health check
  async healthCheck(): Promise<{ available: boolean; latencyMs?: number }>;
}
```

## Providers

### VaultKMSProvider

HashiCorp Vault integration (recommended for production).

**Configuration:**

```typescript
{
  address: 'https://vault.example.com:8200',
  token?: string,                    // For token auth
  namespace?: string,                // Vault namespace
  mountPath: 'secret/dgos',         // KV mount path
  authMethod: 'approle',            // 'token' | 'approle' | 'kubernetes'
  roleId?: string,                  // For AppRole auth
  secretId?: string,                // For AppRole auth
  roleName?: string,                // For K8s auth
  transitMountPath: 'transit',      // Transit engine path
  kvMountPath: 'secret',            // KV engine path
  requestTimeout: 30000,            // Request timeout (ms)
}
```

**Features:**
- Transit encryption engine for encrypt/decrypt
- KV v2 secrets engine for storage
- Multiple authentication methods
- Automatic token renewal
- TLS support

### DevKMSProvider

In-memory provider for development and testing.

**⚠️ WARNING:** Automatically blocked in production (NODE_ENV=production).

**Configuration:**

```typescript
new DevKMSProvider(masterKey?: Buffer)
```

**Features:**
- In-memory storage
- No external dependencies
- Perfect for testing
- Same API as production providers

## Environment Variables

```bash
# KMS Provider Selection
KMS_PROVIDER=vault              # 'dev' | 'vault' | 'aws'

# Vault Configuration
VAULT_ADDR=https://vault:8200
VAULT_AUTH_METHOD=approle       # 'token' | 'approle' | 'kubernetes'
VAULT_TOKEN=                    # For token auth
VAULT_ROLE_ID=                  # For AppRole auth
VAULT_SECRET_ID=                # For AppRole auth
VAULT_ROLE_NAME=                # For K8s auth
VAULT_NAMESPACE=                # Optional namespace
VAULT_MOUNT_PATH=secret/dgos    # KV mount path
```

## Testing

```bash
# Run all tests
pnpm test

# Run KMS-specific tests
pnpm test:kms

# With Vault integration
docker-compose up -d vault
./scripts/init-vault.sh
pnpm test:kms
```

## Performance

Expected performance with Vault in same region:

| Operation | p50 | p99 |
|-----------|-----|-----|
| Store Secret | 15ms | 50ms |
| Retrieve Secret | 10ms | 40ms |
| Encrypt | 8ms | 30ms |
| Decrypt | 8ms | 30ms |

## Security

### Best Practices

1. **Never use DevKMSProvider in production**
2. **Use AppRole or Kubernetes auth (not token auth)**
3. **Enable TLS for all Vault communication**
4. **Rotate secrets regularly**
5. **Monitor KMS health and performance**
6. **Enable audit logging**
7. **Set appropriate TTLs**
8. **Implement proper error handling**

### Access Control

Secrets are scoped by:
- `purpose` - What the secret is for (e.g., 'provider-account')
- `subjectId` - Who owns the secret (e.g., user ID)

Both must match to retrieve a secret.

## Migration

See the main DGOS documentation for migration from Redis/in-memory:

```bash
# Dry run
pnpm migrate:secrets:dry-run

# Execute
pnpm migrate:secrets:execute
```

## Troubleshooting

### "KMS authentication failed"

Check credentials and Vault connectivity:

```bash
export VAULT_ADDR=https://vault:8200
vault status
vault token lookup
```

### "KMS service unavailable"

Check Vault health:

```bash
vault status
curl https://vault:8200/v1/sys/health
```

### High latency

- Ensure Vault is in same region/VPC
- Check network connectivity
- Monitor Vault server load
- Consider connection pooling

## Documentation

- [KMS Integration Guide](../../docs/KMS-Integration.md)
- [Security Best Practices](../../docs/KMS-Security.md)
- [Implementation Summary](../../docs/KMS-Implementation-Summary.md)

## License

Proprietary - DGOS Platform
