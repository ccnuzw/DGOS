# V1 Real Provider Integration Test (P5)

**Status**: ✅ PASSED
**Run ID**: V1-REAL-PROVIDER-P5-2026-10-02T13-33-54-485Z-919f1668
**Duration**: 15.18s
**Date**: 2026-10-02T13:33:54.486Z

## Configuration

- **Provider**: https://cc.nextcc.cc
- **Protocol**: openai-compatible
- **Test Model**: gpt-6-sol
- **Database**: dgos_v1_real_provider_919f1668462b1da0b9fb1a9916e9d742
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
  "database": "dgos_v1_real_provider_919f1668462b1da0b9fb1a9916e9d742",
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
  "namespace": "v1-real-provider:919f1668462b1da0b9fb1a9916e9d742"
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
  "principalId": "133c3177-bcbb-4bd9-ad4b-51f5420041b2"
}
```

### 5. provider_account_created

**Result**: passed

**Facts**:
```json
{
  "accountId": "f34d2b6d-ee46-4268-b218-b7bea3e82f08",
  "protocolType": "openai-compatible",
  "status": "credential_pending"
}
```

### 6. connection_test_succeeded

**Result**: passed

**Facts**:
```json
{
  "testId": "f3821141-7495-4450-bd2a-f80c70053e9a",
  "modelsCount": 20,
  "latencyMs": 200
}
```

### 7. provider_account_activated

**Result**: passed

**Facts**:
```json
{
  "accountId": "f34d2b6d-ee46-4268-b218-b7bea3e82f08"
}
```

### 8. provider_config_created

**Result**: passed

**Facts**:
```json
{
  "providerConfigId": "5d72af46-5733-4c3a-b068-91324d636afa"
}
```

### 9. provider_config_validated

**Result**: passed

**Facts**:
```json
{
  "providerConfigId": "5d72af46-5733-4c3a-b068-91324d636afa"
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
  "taskId": "53c9be06-8486-48ee-987f-73b0b19c7a3a",
  "model": "gpt-6-sol",
  "outputLength": 10,
  "latencyMs": 12963,
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
  "originalTaskId": "53c9be06-8486-48ee-987f-73b0b19c7a3a",
  "replayTaskId": "53c9be06-8486-48ee-987f-73b0b19c7a3a",
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
- Run ID: V1-REAL-PROVIDER-P5-2026-10-02T13-33-54-485Z-919f1668

---
Generated: 2026-10-02T13:34:09.669Z
