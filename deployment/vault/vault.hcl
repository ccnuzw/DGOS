# Vault Production Configuration

ui = true
disable_mlock = false

listener "tcp" {
  address = "0.0.0.0:8200"
  tls_disable = 0
  tls_cert_file = "/vault/config/tls/vault.crt"
  tls_key_file = "/vault/config/tls/vault.key"
}

storage "file" {
  path = "/vault/file"
}

api_addr = "https://vault.example.com:8200"
cluster_addr = "https://vault.example.com:8201"

telemetry {
  prometheus_retention_time = "30s"
  disable_hostname = true
}

# Seal configuration (use auto-unseal in production)
# seal "awskms" {
#   region = "us-west-2"
#   kms_key_id = "alias/vault-unseal-key"
# }
