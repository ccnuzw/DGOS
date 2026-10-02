{
  "schema": "test-report/release/v1",
  "kind": "release",
  "version": "V1",
  "commit": "72ab1cb98b064a6e27b9f60a9f8f00881a827a99",
  "status": "pending",
  "environment": "production-gate",
  "note": "Release gate report - formal testing and approvals pending",
  "development_report": "docs/05-测试与发布/报告/V1-development-report.md",
  "e2e_report": "docs/05-测试与发布/报告/V1-e2e-report.md",
  "checks": {
    "migration": true,
    "backup": true,
    "recovery": true,
    "security": true,
    "smoke": true,
    "observation": true,
    "rollback": true
  },
  "artifact": {
    "id": "v1-release-candidate-20261002",
    "digest": "sha256:pending"
  },
  "approvals": {
    "product": "TBD",
    "technical": "TBD",
    "release_manager": "TBD"
  },
  "known_risks": [
    "Unified candidate not executed against single frozen commit",
    "Native bridge timeout blocking macOS scenarios",
    "Security vulnerabilities require remediation",
    "Real external provider not tested"
  ],
  "release_decision": "not_ready"
}
