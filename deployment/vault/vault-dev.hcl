# Vault Development Configuration

ui = true
disable_mlock = true

listener "tcp" {
  address = "0.0.0.0:8200"
  tls_disable = 1
}

storage "file" {
  path = "/vault/file"
}

api_addr = "http://0.0.0.0:8200"

telemetry {
  prometheus_retention_time = "30s"
  disable_hostname = true
}
