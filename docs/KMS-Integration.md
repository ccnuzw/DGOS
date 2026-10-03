# KMS Integration Guide

## Overview

DGOS now integrates with external Key Management Services (KMS) for production-grade secret management, replacing in-memory and Redis-based secret storage. This satisfies the P1 requirement identified in FR-003 and FR-007 evaluations.

## Supported KMS Providers

### 1. HashiCorp Vault (Recommended)
- ✅ Open source and flexible
- ✅ Multi-cloud support
- ✅ Advanced secret management features
- ✅ Audit logging built-in
- ✅ Secret versioning and rotation

### 2. AWS KMS + Secrets Manager (Future)
- AWS-native solution
- Automatic key rotation
- IAM integration

### 3. GCP Secret Manager (Future)
- GCP-native solution
- Automatic replication
- Cloud IAM integration

### 4. Development Provider
- ⚠️ **DEVELOPMENT ONLY** - Never use in production
- In-memory storage for testing
- Automatically blocked when NODE_ENV=production

## Quick Start

### Development Setup

1. **Start Vault with Docker Compose:**
```bash
docker-compose up -d vault
```

2. **Initialize Vault:**
```bash
export VAULT_ADDR=http://localhost:8200
export VAULT_TOKEN=dev-root-token
./scripts/init-vault.sh
```

3. **Configure environment:**
```bash
# .env
KMS_PROVIDER=vault
VAULT_ADDR=http://localhost:8200
VAULT_AUTH_METHOD=token
VAULT_TOKEN=dev-root-token
```

4. **Migrate existing secrets:**
```bash
# Dry run first
node scripts/migrate-secrets-to-kms.mjs --dry-run

# Execute migration
node scripts/migrate-secrets-to-kms.mjs --execute --verify
```

### Production Deployment

#### Option 1: Vault with AppRole Authentication

1. **Deploy Vault:**
   - Use official Vault Helm chart for Kubernetes
   - Or deploy Vault cluster manually
   - Enable auto-unseal with cloud KMS

2. **Configure Vault:**
```bash
# Enable secrets engines
vault secrets enable -path=dgos -version=2 kv
vault secrets enable transit

# Create master encryption key
vault write -f transit/keys/dgos-master type=aes256-gcm96

# Create policy
vault policy write dgos-api /path/to/dgos-policy.hcl

# Enable AppRole
vault auth enable approle
vault write auth/approle/role/dgos-api \
  token_policies="dgos-api" \
  token_ttl=1h \
  token_max_ttl=24h
```

3. **Get credentials:**
```bash
ROLE_ID=$(vault read -field=role_id auth/approle/role/dgos-api/role-id)
SECRET_ID=$(vault write -field=secret_id -f auth/approle/role/dgos-api/secret-id)
```

4. **Configure DGOS:**
```bash
# Production .env
NODE_ENV=production
KMS_PROVIDER=vault
VAULT_ADDR=https://vault.example.com:8200
VAULT_AUTH_METHOD=approle
VAULT_ROLE_ID=<role-id>
VAULT_SECRET_ID=<secret-id>
VAULT_MOUNT_PATH=secret/dgos
```

#### Option 2: Vault with Kubernetes Authentication

1. **Configure Vault Kubernetes auth:**
```bash
vault auth enable kubernetes
vault write auth/kubernetes/config \
  kubernetes_host=https://kubernetes.default.svc \
  kubernetes_ca_cert=@/var/run/secrets/kubernetes.io/serviceaccount/ca.crt

vault write auth/kubernetes/role/dgos-api \
  bound_service_account_names=dgos-api \
  bound_service_account_namespaces=default \
  policies=dgos-api \
  ttl=1h
```

2. **Configure DGOS:**
```bash
# Production .env
NODE_ENV=production
KMS_PROVIDER=vault
VAULT_ADDR=https://vault.example.com:8200
VAULT_AUTH_METHOD=kubernetes
VAULT_ROLE_NAME=dgos-api
VAULT_MOUNT_PATH=secret/dgos
```

## Architecture

### Components

```
┌─────────────────────────────────────────────────────┐
│                   DGOS API Server                    │
│                                                      │
│  ┌────────────────────────────────────────────┐   │
│  │        KMSSecretService                     │   │
│  │  (Implements SecretService Interface)       │   │
│  └─────────────────┬──────────────────────────┘   │
│                    │                               │
│  ┌─────────────────▼──────────────────────────┐   │
│  │         KMSProvider Interface               │   │
│  │  - encrypt() / decrypt()                    │   │
│  │  - storeSecret() / retrieveSecret()         │   │
│  │  - rotateSecret() / deleteSecret()          │   │
│  └─────────────────┬──────────────────────────┘   │
│                    │                               │
└────────────────────┼───────────────────────────────┘
                     │
        ┌────────────┼────────────┬─────────────┐
        │            │            │             │
   ┌────▼───┐  ┌────▼────┐  ┌───▼────┐   ┌───▼────┐
   │ Vault  │  │  AWS    │  │  GCP   │   │  Dev   │
   │  KMS   │  │  KMS    │  │ Secret │   │  KMS   │
   │Provider│  │Provider │  │Manager │   │Provider│
   └────────┘  └─────────┘  └────────┘   └────────┘
```

### Secret Flow

1. **Storage:** Provider credentials → KMS → Encrypted storage
2. **Retrieval:** Request → Scope validation → KMS decryption → Handle with TTL
3. **Rotation:** New version → KMS storage → Old version grace period
4. **Revocation:** Delete from KMS → Immediately unavailable

## API Reference

### KMSProvider Interface

```typescript
interface KMSProvider {
  init(): Promise<void>;
  healthCheck(): Promise<KMSHealthStatus>;
  encrypt(plaintext: string, context?: EncryptionContext): Promise<EncryptedData>;
  decrypt(encrypted: EncryptedData, context?: EncryptionContext): Promise<string>;
  storeSecret(key: string, value: string, metadata?: SecretMetadata): Promise<SecretRef>;
  retrieveSecret(ref: SecretRef): Promise<SecretValue>;
  rotateSecret(ref: SecretRef, newValue?: string): Promise<SecretRef>;
  deleteSecret(ref: SecretRef, hardDelete?: boolean): Promise<void>;
  listSecrets(prefix?: string): Promise<SecretRef[]>;
  close(): Promise<void>;
}
```

### KMSSecretService

Compatible with existing `SecretService` interface:

```typescript
class KMSSecretService {
  async put({ secretRef, value, purpose, subjectId, ttlMs }): Promise<Result>;
  async resolve({ secretRef, purpose, subjectId }): Promise<Handle>;
  async revoke(secretRef: string): Promise<void>;
  async inspect(secretRef: string): Promise<State>;
  async healthCheck(): Promise<Health>;
}
```

## Migration

### Pre-Migration Checklist

- [ ] Vault deployed and accessible
- [ ] Vault initialized with secrets engines
- [ ] AppRole/K8s auth configured
- [ ] Network connectivity verified
- [ ] Backup of existing Redis data
- [ ] Tested in staging environment

### Migration Steps

1. **Dry run to assess scope:**
```bash
node scripts/migrate-secrets-to-kms.mjs --dry-run
```

2. **Execute migration:**
```bash
node scripts/migrate-secrets-to-kms.mjs --execute --verify
```

3. **Verify all secrets migrated:**
```bash
# Check migration summary
# Verify provider accounts can authenticate
# Test MCP connections
```

4. **Update configuration:**
```bash
# Switch to KMS provider
KMS_PROVIDER=vault
```

5. **Restart services:**
```bash
docker-compose restart dgos-api dgos-worker
```

6. **Clean up Redis (optional):**
```bash
node scripts/migrate-secrets-to-kms.mjs --cleanup
```

### Rollback Procedure

If migration fails:

1. **Keep KMS_PROVIDER=none** or unset
2. **Restart services** (will use Redis/in-memory)
3. **Investigate migration errors**
4. **Fix issues and retry**

## Monitoring

### Health Checks

```bash
# Check KMS health endpoint
curl http://localhost:3000/v1/system/health

# Response includes KMS status
{
  "kms": {
    "available": true,
    "latencyMs": 15,
    "provider": "vault"
  }
}
```

### Metrics

Monitor these KMS-related metrics:

- `kms_operations_total` - Total KMS operations
- `kms_operation_duration_ms` - Operation latency
- `kms_errors_total` - KMS errors
- `kms_health_check_status` - Health check results
- `secret_rotation_total` - Secret rotations

### Alerts

Recommended alerts:

- **KMS Unavailable:** `kms_health_check_status == 0` for > 1 minute
- **High Latency:** `kms_operation_duration_ms > 1000ms` p99
- **High Error Rate:** `kms_errors_total` rate > 1% of operations
- **Secret Expiration:** Secrets expiring within 7 days

## Security

### Best Practices

1. **Use AppRole or Kubernetes Auth** in production (never token auth)
2. **Enable Vault audit logging** for compliance
3. **Rotate AppRole SecretIDs** regularly
4. **Use TLS** for Vault communication
5. **Implement token renewal** for long-running services
6. **Set appropriate TTLs** on secrets (default: 1 year for provider credentials)
7. **Enable auto-unseal** with cloud KMS in production
8. **Backup Vault data** regularly
9. **Monitor access patterns** for anomalies
10. **Implement secret rotation** policies

### Access Control

Vault policy for DGOS:

```hcl
# Full access to DGOS secrets
path "dgos/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Transit encryption operations
path "transit/encrypt/dgos-master" {
  capabilities = ["update"]
}

path "transit/decrypt/dgos-master" {
  capabilities = ["update"]
}

# Key info (no key export)
path "transit/keys/dgos-master" {
  capabilities = ["read"]
}
```

## Troubleshooting

### Common Issues

#### 1. "KMS authentication failed"

**Cause:** Invalid credentials or expired token

**Solution:**
```bash
# For AppRole
vault write -f auth/approle/role/dgos-api/secret-id

# For Token
export VAULT_TOKEN=$(vault token create -policy=dgos-api -format=json | jq -r .auth.client_token)
```

#### 2. "KMS service unavailable"

**Cause:** Network connectivity or Vault is down

**Solution:**
```bash
# Check Vault status
vault status

# Check network
curl -v http://vault-address:8200/v1/sys/health

# Check DGOS logs
docker-compose logs dgos-api | grep kms
```

#### 3. "Secret not found after migration"

**Cause:** Migration incomplete or path mismatch

**Solution:**
```bash
# Re-run migration with verification
node scripts/migrate-secrets-to-kms.mjs --execute --verify

# Check Vault directly
vault kv list dgos/secrets
vault kv get dgos/secrets/provider-credential:account-id
```

#### 4. "Performance degradation"

**Cause:** High KMS latency

**Solution:**
- Deploy Vault closer to DGOS (same region/VPC)
- Enable connection pooling
- Increase timeout: `VAULT_REQUEST_TIMEOUT=60000`
- Consider caching strategies (with caution)

## Testing

Run KMS integration tests:

```bash
# Unit tests
pnpm test:security

# Integration tests with Vault
docker-compose up -d vault
./scripts/init-vault.sh
pnpm test tests/security/kms-provider.test.mjs

# End-to-end tests
pnpm test:integration
```

## Performance

Expected performance characteristics:

| Operation | Latency (p50) | Latency (p99) |
|-----------|---------------|---------------|
| Store Secret | 15ms | 50ms |
| Retrieve Secret | 10ms | 40ms |
| Encrypt | 8ms | 30ms |
| Decrypt | 8ms | 30ms |
| Health Check | 5ms | 20ms |

*Based on Vault in same region/VPC*

## References

- [HashiCorp Vault Documentation](https://www.vaultproject.io/docs)
- [Vault Transit Secrets Engine](https://www.vaultproject.io/docs/secrets/transit)
- [Vault KV v2 Secrets Engine](https://www.vaultproject.io/docs/secrets/kv/kv-v2)
- [Vault AppRole Auth](https://www.vaultproject.io/docs/auth/approle)
- [Vault Kubernetes Auth](https://www.vaultproject.io/docs/auth/kubernetes)
