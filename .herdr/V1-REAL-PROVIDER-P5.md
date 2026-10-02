# V1 Real Provider Integration Test (P5)

**Status**: ✅ PASSED
**Run ID**: V1-REAL-PROVIDER-P5-2026-10-02T11-33-24-844Z-3cd10953
**Duration**: 4.31s
**Date**: 2026-10-02T11:33:24.845Z

## Configuration

- **Provider**: https://cc.nextcc.cc
- **Protocol**: openai-compatible
- **Test Model**: gpt-6-sol
- **Database**: dgos_v1_real_provider_3cd1095380d6b1256ce79547a43a0f3a
- **Redis**: DB 7

## Costs

- **Real Tasks Executed**: 1
- **Tokens Used**: 4405 (4398 in + 7 out)

## Test Cases (17)

### 1. isolated_database_with_migrations

**Result**: passed

**Facts**:
```json
{
  "database": "dgos_v1_real_provider_3cd1095380d6b1256ce79547a43a0f3a",
  "migrationCount": 47,
  "latestVersion": "0051-proxy-provisioning"
}
```

### 2. redis_secret_service_ready

**Result**: passed

**Facts**:
```json
{
  "redisDb": "7",
  "namespace": "v1-real-provider:3cd1095380d6b1256ce79547a43a0f3a"
}
```

### 3. api_server_listening

**Result**: passed

**Facts**:
```json
{
  "port": 15181
}
```

### 4. admin_identity_bootstrapped

**Result**: passed

**Facts**:
```json
{
  "principalId": "b45474df-e73e-4ece-b842-537e2e9d52eb"
}
```

### 5. provider_account_created

**Result**: passed

**Facts**:
```json
{
  "accountId": "9f4d29de-f39b-4f37-bf60-f8d314eb0eb1",
  "protocolType": "openai-compatible",
  "status": "credential_pending"
}
```

### 6. connection_test_succeeded

**Result**: passed

**Facts**:
```json
{
  "testId": "a1c4ad26-de87-4f14-8c98-3436be5b7c08",
  "modelsCount": 20,
  "latencyMs": 200
}
```

### 7. provider_account_activated

**Result**: passed

**Facts**:
```json
{
  "accountId": "9f4d29de-f39b-4f37-bf60-f8d314eb0eb1"
}
```

### 8. provider_config_created

**Result**: passed

**Facts**:
```json
{
  "providerConfigId": "7830c05f-5c91-4fbf-a55d-39d6fd38f1ec"
}
```

### 9. provider_config_validated

**Result**: passed

**Facts**:
```json
{
  "providerConfigId": "7830c05f-5c91-4fbf-a55d-39d6fd38f1ec"
}
```

### 10. model_catalog_refreshed

**Result**: passed

**Facts**:
```json
{
  "catalogVersion": "1",
  "totalModels": 20,
  "refreshStatus": "fresh",
  "testModel": "gpt-6-sol",
  "testModelFound": true
}
```

### 11. test_model_enabled

**Result**: passed

**Facts**:
```json
{
  "modelId": "gpt-6-sol"
}
```

### 12. quota_policy_configured

**Result**: passed

**Facts**:
```json
{
  "hardLimit": 10,
  "windowSeconds": 3600
}
```

### 13. real_ai_task_executed

**Result**: passed

**Facts**:
```json
{
  "taskId": "7f59e312-c4e3-4395-a6c9-988032fd36de",
  "model": "gpt-6-sol",
  "outputLength": 10,
  "latencyMs": 2067,
  "usage": {
    "inputTokens": 4398,
    "outputTokens": 7,
    "totalTokens": 4405
  },
  "sseStreamingWorked": true,
  "artifactCreated": true
}
```

### 14. task_api_verification

**Result**: passed

**Facts**:
```json
{
  "status": "succeeded",
  "hasOutput": true
}
```

### 15. task_replay_idempotent

**Result**: passed

**Facts**:
```json
{
  "originalTaskId": "7f59e312-c4e3-4395-a6c9-988032fd36de",
  "replayTaskId": "7f59e312-c4e3-4395-a6c9-988032fd36de",
  "matched": true,
  "noAdditionalApiCall": true
}
```

### 16. security_verified

**Result**: passed

**Facts**:
```json
{
  "apiKeyNotInLogs": true,
  "tlsUsed": true,
  "secretsStored": 4,
  "auditEventsChecked": 8
}
```

### 17. invalid_model_rejected

**Result**: passed

**Facts**:
```json
{
  "errorKey": "model_not_found"
}
```




## Summary


- Total Cases: 17
- Passed: 17
- Real Tasks: 1
- Total Tokens: 4405


## Warnings

⚠️  REAL external Provider with actual API costs
⚠️  Minimal test suite (1-2 tasks)
⚠️  API key stored in Redis (encrypted)
⚠️  DO NOT commit API key to git

## Evidence

- Report: /Users/apple/Progame/DGOS/.herdr/V1-REAL-PROVIDER-P5.md
- Run ID: V1-REAL-PROVIDER-P5-2026-10-02T11-33-24-844Z-3cd10953

---
Generated: 2026-10-02T11:33:29.155Z
