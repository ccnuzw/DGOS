#!/bin/bash
set -e

echo "Initializing Vault for DGOS..."

# Wait for Vault to be ready
until vault status > /dev/null 2>&1; do
  echo "Waiting for Vault to be ready..."
  sleep 2
done

echo "✓ Vault is ready"

# Enable KV v2 secrets engine for DGOS
echo "Enabling KV v2 secrets engine..."
vault secrets enable -path=dgos -version=2 kv || echo "KV engine already enabled"

# Enable Transit secrets engine for encryption
echo "Enabling Transit secrets engine..."
vault secrets enable transit || echo "Transit engine already enabled"

# Create DGOS master key for encryption
echo "Creating DGOS master encryption key..."
vault write -f transit/keys/dgos-master type=aes256-gcm96 || echo "Transit key already exists"

# Create policy for DGOS API
echo "Creating DGOS API policy..."
vault policy write dgos-api - <<EOF
# Allow full access to DGOS secrets
path "dgos/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Allow access to transit encryption
path "transit/encrypt/dgos-master" {
  capabilities = ["update"]
}

path "transit/decrypt/dgos-master" {
  capabilities = ["update"]
}

path "transit/datakey/plaintext/dgos-master" {
  capabilities = ["update"]
}

path "transit/keys/dgos-master" {
  capabilities = ["read"]
}

# Allow token renewal
path "auth/token/renew-self" {
  capabilities = ["update"]
}
EOF

# Enable AppRole auth method
echo "Enabling AppRole auth method..."
vault auth enable approle || echo "AppRole already enabled"

# Create AppRole for DGOS API
echo "Creating DGOS API AppRole..."
vault write auth/approle/role/dgos-api \
  token_policies="dgos-api" \
  token_ttl=1h \
  token_max_ttl=24h \
  secret_id_ttl=0 \
  secret_id_num_uses=0

# Get RoleID and SecretID
echo ""
echo "==================================="
echo "DGOS Vault Configuration Complete"
echo "==================================="
echo ""
echo "Add these to your .env file:"
echo ""
echo "KMS_PROVIDER=vault"
echo "VAULT_ADDR=http://localhost:8200"
echo "VAULT_AUTH_METHOD=approle"
ROLE_ID=$(vault read -field=role_id auth/approle/role/dgos-api/role-id)
SECRET_ID=$(vault write -field=secret_id -f auth/approle/role/dgos-api/secret-id)
echo "VAULT_ROLE_ID=$ROLE_ID"
echo "VAULT_SECRET_ID=$SECRET_ID"
echo ""
echo "For development with token auth:"
echo "VAULT_AUTH_METHOD=token"
echo "VAULT_TOKEN=dev-root-token"
echo ""
echo "==================================="
