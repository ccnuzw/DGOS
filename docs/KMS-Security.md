# KMS Security Best Practices

## Overview

This document outlines security best practices for deploying and operating DGOS with KMS integration in production environments.

## Authentication & Authorization

### Production Authentication Methods

#### 1. AppRole (Recommended for VMs/Containers)

**Setup:**
```bash
# Enable AppRole
vault auth enable approle

# Create role with appropriate policies
vault write auth/approle/role/dgos-api \
  token_policies="dgos-api" \
  token_ttl=1h \
  token_max_ttl=24h \
  bind_secret_id=true \
  secret_id_ttl=0 \
  secret_id_num_uses=0

# Generate credentials
ROLE_ID=$(vault read -field=role_id auth/approle/role/dgos-api/role-id)
SECRET_ID=$(vault write -field=secret_id -f auth/approle/role/dgos-api/secret-id)
```

**Best Practices:**
- Store RoleID in configuration (low sensitivity)
- Store SecretID in secure secrets management (high sensitivity)
- Rotate SecretID every 90 days minimum
- Use separate AppRoles per environment (dev/staging/prod)
- Monitor failed authentication attempts

#### 2. Kubernetes Auth (Recommended for K8s)

**Setup:**
```bash
# Enable Kubernetes auth
vault auth enable kubernetes

# Configure Kubernetes auth
vault write auth/kubernetes/config \
  kubernetes_host="https://$KUBERNETES_PORT_443_TCP_ADDR:443" \
  kubernetes_ca_cert=@/var/run/secrets/kubernetes.io/serviceaccount/ca.crt

# Create role bound to service account
vault write auth/kubernetes/role/dgos-api \
  bound_service_account_names=dgos-api \
  bound_service_account_namespaces=production \
  policies=dgos-api \
  ttl=1h
```

**Best Practices:**
- Use dedicated service accounts per application
- Bind roles to specific namespaces
- Limit token TTL to minimum required
- Enable Kubernetes audit logging
- Rotate service account tokens regularly

### Token Management

**Token Renewal:**
```typescript
// Automatic token renewal in KMS client
class VaultKMSProvider {
  private async renewToken() {
    if (this.tokenTTL < 300) { // Renew if < 5 minutes
      await this.client.tokenRenewSelf();
    }
  }
}
```

**Best Practices:**
- Renew tokens before expiration (at 2/3 of TTL)
- Monitor token renewal failures
- Implement graceful degradation on auth failures
- Log authentication events for audit

## Secret Access Control

### Vault Policies

**Principle of Least Privilege:**

```hcl
# dgos-api-policy.hcl - Minimal required permissions

# Read/Write DGOS secrets
path "dgos/data/*" {
  capabilities = ["create", "read", "update", "delete"]
}

# List secrets for migration
path "dgos/metadata/*" {
  capabilities = ["list", "read"]
}

# Transit encryption
path "transit/encrypt/dgos-master" {
  capabilities = ["update"]
}

path "transit/decrypt/dgos-master" {
  capabilities = ["update"]
}

path "transit/datakey/plaintext/dgos-master" {
  capabilities = ["update"]
}

# Read key metadata only (no export)
path "transit/keys/dgos-master" {
  capabilities = ["read"]
  denied_parameters = {
    "exportable" = []
  }
}

# Token self-renewal
path "auth/token/renew-self" {
  capabilities = ["update"]
}

# Token self-lookup
path "auth/token/lookup-self" {
  capabilities = ["read"]
}

# Deny everything else
path "*" {
  capabilities = ["deny"]
}
```

**Environment-Specific Policies:**

```hcl
# Production - Strict
path "dgos/data/production/*" {
  capabilities = ["create", "read", "update"]
  # No delete in production
}

# Staging - Moderate
path "dgos/data/staging/*" {
  capabilities = ["create", "read", "update", "delete"]
}

# Development - Permissive
path "dgos/data/development/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
```

## Encryption at Rest

### Vault Storage Encryption

**File Storage Backend:**
```hcl
storage "file" {
  path = "/vault/file"
}

# Vault automatically encrypts all data at rest
# Master key derived from unseal keys or auto-unseal
```

**High Availability with Raft:**
```hcl
storage "raft" {
  path = "/vault/data"
  node_id = "node1"
}

# Raft storage is encrypted with Vault's master key
```

**Auto-Unseal (Production Required):**

```hcl
# AWS KMS Auto-Unseal
seal "awskms" {
  region     = "us-west-2"
  kms_key_id = "alias/vault-unseal"
}

# GCP Cloud KMS Auto-Unseal
seal "gcpckms" {
  project     = "my-project"
  region      = "us-west1"
  key_ring    = "vault"
  crypto_key  = "vault-unseal"
}

# Azure Key Vault Auto-Unseal
seal "azurekeyvault" {
  tenant_id      = "tenant-uuid"
  vault_name     = "vault-unseal"
  key_name       = "vault-key"
}
```

**Benefits of Auto-Unseal:**
- No manual unseal after restart
- Master key never exposed
- Simplified disaster recovery
- Cloud provider key management

## Encryption in Transit

### TLS Configuration

**Vault TLS:**
```hcl
listener "tcp" {
  address       = "0.0.0.0:8200"
  tls_disable   = 0
  tls_cert_file = "/vault/config/tls/vault.crt"
  tls_key_file  = "/vault/config/tls/vault.key"
  
  # Strong TLS configuration
  tls_min_version = "tls12"
  tls_cipher_suites = [
    "TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384",
    "TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256",
  ]
}
```

**DGOS Client TLS:**
```typescript
const provider = new VaultKMSProvider({
  address: 'https://vault.example.com:8200',
  ca: fs.readFileSync('/path/to/vault-ca.crt'),
  // Client certificate auth (optional)
  cert: fs.readFileSync('/path/to/client.crt'),
  key: fs.readFileSync('/path/to/client.key'),
});
```

**Best Practices:**
- Use TLS 1.2 or higher
- Disable weak cipher suites
- Use valid certificates from trusted CA
- Implement certificate rotation
- Enable mutual TLS for high-security environments

## Audit Logging

### Vault Audit Devices

**File Audit:**
```bash
vault audit enable file file_path=/vault/logs/audit.log
```

**Syslog Audit:**
```bash
vault audit enable syslog
```

**Socket Audit (for log aggregation):**
```bash
vault audit enable socket address=logstash:9200 socket_type=tcp
```

**Audit Log Format:**
```json
{
  "time": "2024-01-15T10:30:00Z",
  "type": "response",
  "auth": {
    "client_token": "hmac-sha256:...",
    "accessor": "hmac-sha256:...",
    "display_name": "approle",
    "policies": ["dgos-api"],
    "token_policies": ["dgos-api"]
  },
  "request": {
    "id": "request-uuid",
    "operation": "read",
    "path": "dgos/data/secrets/provider-credential:123",
    "remote_address": "10.0.1.5"
  },
  "response": {
    "data": {
      "data": {
        "value": "hmac-sha256:..."  // Sensitive fields hashed
      }
    }
  }
}
```

**Best Practices:**
- Enable at least one audit device
- Use multiple audit devices for redundancy
- Ship logs to SIEM (Splunk, ELK, etc.)
- Set up alerts for suspicious activity
- Retain audit logs per compliance requirements

### DGOS Application Logging

**Audit Events:**
```typescript
await auditLog.write({
  operation: 'secret.accessed',
  secretRef: 'provider-credential:account-id',
  purpose: 'provider-account',
  subjectId: 'user-123',
  result: 'success',
  kms: {
    provider: 'vault',
    latencyMs: 15,
  },
});
```

**Security Events to Log:**
- Secret access (read/write/delete)
- Authentication attempts (success/failure)
- Authorization failures
- KMS health check failures
- Unusual access patterns
- Secret rotation events

## Secret Rotation

### Rotation Strategy

**Provider Credentials:**
```bash
# Rotate every 90 days
0 0 1 */3 * /usr/local/bin/rotate-provider-credentials.sh
```

**Rotation Script:**
```typescript
async function rotateProviderCredential(accountId: string) {
  // 1. Generate new credential with provider
  const newCredential = await providerAPI.createNewKey();
  
  // 2. Store in KMS
  const newRef = await kmsService.rotateSecret(
    { path: `secrets/provider-credential:${accountId}` },
    newCredential
  );
  
  // 3. Test new credential
  await testProviderConnection(accountId, newCredential);
  
  // 4. Update database reference
  await db.query(
    'UPDATE provider_accounts SET credential_ref = $1 WHERE account_id = $2',
    [newRef.path, accountId]
  );
  
  // 5. Keep old credential for grace period (24h)
  await scheduleOldCredentialRevocation(accountId, 24 * 3600);
}
```

**Master Key Rotation:**
```bash
# Rotate Vault transit key annually
vault write -f transit/keys/dgos-master/rotate

# Re-wrap all secrets with new key
vault write -f transit/rewrap/dgos-master
```

## Backup & Recovery

### Vault Backup

**Snapshot Backup:**
```bash
# Create snapshot
vault operator raft snapshot save backup.snap

# Restore from snapshot
vault operator raft snapshot restore backup.snap
```

**Automated Backup:**
```bash
#!/bin/bash
# Daily backup script
DATE=$(date +%Y%m%d)
vault operator raft snapshot save /backups/vault-${DATE}.snap
# Upload to S3/GCS
aws s3 cp /backups/vault-${DATE}.snap s3://vault-backups/
```

**Recovery Testing:**
```bash
# Test restore procedure quarterly
1. Deploy test Vault cluster
2. Restore from backup
3. Verify data integrity
4. Test application access
5. Document any issues
```

### Disaster Recovery

**Recovery Procedures:**

1. **Vault Cluster Failure:**
   - Deploy new Vault cluster
   - Restore from latest snapshot
   - Update DNS/load balancer
   - Re-initialize auto-unseal
   - Verify application connectivity

2. **KMS Unavailable:**
   - Check Vault cluster health
   - Verify network connectivity
   - Check authentication credentials
   - Review audit logs for errors
   - Implement fallback if configured

3. **Data Corruption:**
   - Identify corruption extent
   - Restore from clean backup
   - Re-migrate affected secrets
   - Update application references
   - Verify integrity checks pass

## Compliance

### GDPR Considerations

**Right to Erasure:**
```typescript
// Hard delete secrets containing personal data
await kmsProvider.deleteSecret(
  { path: `secrets/user-${userId}` },
  true // hardDelete = true
);
```

**Data Minimization:**
- Store only essential credentials
- Set appropriate TTLs
- Implement automatic cleanup
- Document data retention policy

### SOC 2 / ISO 27001

**Required Controls:**
- ✅ Encryption at rest (Vault storage encryption)
- ✅ Encryption in transit (TLS)
- ✅ Access control (Vault policies)
- ✅ Audit logging (Vault audit devices)
- ✅ Key rotation (Transit key rotation)
- ✅ Backup & recovery (Snapshot backups)
- ✅ Least privilege (AppRole/K8s auth)

### PCI DSS

**Key Management:**
- ✅ Cryptographic key management system (Vault)
- ✅ Key generation procedures (Transit engine)
- ✅ Key distribution controls (AppRole)
- ✅ Key storage security (Auto-unseal)
- ✅ Key change procedures (Rotation scripts)
- ✅ Key destruction procedures (Hard delete)

## Incident Response

### Security Incident Playbook

**Suspected Compromise:**

1. **Immediate Actions:**
   - Revoke compromised credentials
   - Rotate affected secrets
   - Block suspicious access
   - Enable additional logging

2. **Investigation:**
   - Review audit logs
   - Identify access patterns
   - Determine scope of compromise
   - Collect forensic evidence

3. **Remediation:**
   - Rotate all potentially affected secrets
   - Update authentication methods
   - Patch vulnerabilities
   - Update policies

4. **Post-Incident:**
   - Document timeline
   - Update runbooks
   - Improve monitoring
   - Conduct lessons learned

**Emergency Contacts:**
- Security Team: security@example.com
- On-Call: +1-555-ONCALL
- Vault Admin: vault-admin@example.com

## Monitoring & Alerting

### Critical Alerts

**KMS Health:**
```yaml
- alert: KMSUnavailable
  expr: kms_health_check_status == 0
  for: 1m
  severity: critical
  
- alert: KMSHighLatency
  expr: histogram_quantile(0.99, kms_operation_duration_seconds) > 1
  for: 5m
  severity: warning
```

**Authentication:**
```yaml
- alert: VaultAuthFailures
  expr: rate(vault_auth_login_failures_total[5m]) > 10
  for: 1m
  severity: warning

- alert: TokenExpirationImminent
  expr: vault_token_ttl_seconds < 300
  for: 1m
  severity: warning
```

**Secret Access:**
```yaml
- alert: UnusualSecretAccess
  expr: rate(dgos_secret_access_total[5m]) > 100
  for: 5m
  severity: warning

- alert: SecretAccessFromUnknownIP
  expr: dgos_secret_access_unknown_ip_total > 0
  for: 1m
  severity: critical
```

## References

- [Vault Security Model](https://www.vaultproject.io/docs/internals/security)
- [Vault Production Hardening](https://learn.hashicorp.com/tutorials/vault/production-hardening)
- [Vault Audit Devices](https://www.vaultproject.io/docs/audit)
- [OWASP Key Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html)
