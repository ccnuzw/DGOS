# DGOS V1 API Reference

**Version**: V1.0.0  
**Last Updated**: 2026-10-02  
**Base URL**: `http://localhost:3000/api/v1`

---

## Table of Contents

1. [Authentication](#authentication)
2. [Error Handling](#error-handling)
3. [Identity & Session API](#identity--session-api)
4. [Provider Management API](#provider-management-api)
5. [Task Execution API](#task-execution-api)
6. [Package Management API](#package-management-api)
7. [Extension Management API](#extension-management-api)
8. [Audit Log API](#audit-log-api)

---

## Authentication

### Session-Based Authentication

**Login**:
```http
POST /api/v1/identity/session
Content-Type: application/json

{
  "username": "admin",
  "password": "password"
}
```

**Response**:
```json
{
  "sessionId": "sess_abc123",
  "principalId": "principal_xyz",
  "expiresAt": "2026-10-03T12:00:00Z"
}
```

**Session Cookie**:
- Cookie name: `dgos.session`
- HttpOnly: `true`
- Secure: `true` (HTTPS only)
- SameSite: `Lax`

### API Key Authentication

**Create API Key**:
```http
POST /api/v1/identity/api-keys
Authorization: Bearer <session-token>
Content-Type: application/json

{
  "name": "My API Key",
  "scope": ["task:submit", "provider:read"],
  "expiresAt": "2027-01-01T00:00:00Z"
}
```

**Use API Key**:
```http
GET /api/v1/provider/configs
Authorization: Bearer <api-key>
```

---

## Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "modelId",
      "reason": "Model not found"
    },
    "requestId": "req_abc123"
  }
}
```

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created |
| 204 | No Content | Success, no body |
| 400 | Bad Request | Invalid request |
| 401 | Unauthorized | Authentication required |
| 403 | Forbidden | Permission denied |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource conflict |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Service down |

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid input |
| `AUTHENTICATION_ERROR` | 401 | Auth failed |
| `AUTHORIZATION_ERROR` | 403 | Permission denied |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `PROVIDER_ERROR` | 502 | Provider call failed |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Identity & Session API

### Bootstrap Principal

**Create Initial Administrator**:
```http
POST /api/v1/identity/bootstrap
Content-Type: application/json

{
  "username": "admin",
  "password": "secure-password-123",
  "email": "admin@example.com"
}
```

**Response**:
```json
{
  "principalId": "principal_abc123",
  "username": "admin",
  "createdAt": "2026-10-02T12:00:00Z"
}
```

### Create Session

```http
POST /api/v1/identity/session
Content-Type: application/json

{
  "username": "admin",
  "password": "password"
}
```

### Get Current Session

```http
GET /api/v1/identity/session
Cookie: dgos.session=<session-id>
```

**Response**:
```json
{
  "sessionId": "sess_abc123",
  "principalId": "principal_xyz",
  "username": "admin",
  "createdAt": "2026-10-02T10:00:00Z",
  "expiresAt": "2026-10-02T14:00:00Z",
  "lastActivityAt": "2026-10-02T12:30:00Z"
}
```

### Revoke Session

```http
DELETE /api/v1/identity/session
Cookie: dgos.session=<session-id>
```

### List API Keys

```http
GET /api/v1/identity/api-keys
Authorization: Bearer <session-token>
```

**Response**:
```json
{
  "keys": [
    {
      "keyId": "key_abc123",
      "name": "My API Key",
      "scope": ["task:submit", "provider:read"],
      "createdAt": "2026-10-01T00:00:00Z",
      "expiresAt": "2027-01-01T00:00:00Z",
      "lastUsedAt": "2026-10-02T12:00:00Z"
    }
  ]
}
```

### Revoke API Key

```http
DELETE /api/v1/identity/api-keys/{keyId}
Authorization: Bearer <session-token>
```

---

## Provider Management API

### List Provider Configs

```http
GET /api/v1/provider/configs
Authorization: Bearer <api-key>
```

**Response**:
```json
{
  "providers": [
    {
      "providerId": "provider_abc123",
      "name": "OpenAI Production",
      "protocol": "openai-compatible",
      "baseUrl": "https://api.openai.com/v1",
      "enabled": true,
      "status": "active",
      "lastTestedAt": "2026-10-02T11:00:00Z",
      "catalogVersion": 3,
      "modelCount": 15
    }
  ]
}
```

### Create Provider Config

```http
POST /api/v1/provider/configs
Authorization: Bearer <api-key>
Content-Type: application/json

{
  "name": "OpenAI Production",
  "protocol": "openai-compatible",
  "baseUrl": "https://api.openai.com/v1",
  "credentials": {
    "apiKey": "sk-..."
  },
  "timeout": 60000
}
```

**Response**:
```json
{
  "providerId": "provider_abc123",
  "name": "OpenAI Production",
  "protocol": "openai-compatible",
  "enabled": false,
  "createdAt": "2026-10-02T12:00:00Z"
}
```

### Get Provider Config

```http
GET /api/v1/provider/configs/{providerId}
Authorization: Bearer <api-key>
```

### Update Provider Config

```http
PATCH /api/v1/provider/configs/{providerId}
Authorization: Bearer <api-key>
Content-Type: application/json

{
  "name": "OpenAI Production (Updated)",
  "enabled": true
}
```

### Delete Provider Config

```http
DELETE /api/v1/provider/configs/{providerId}
Authorization: Bearer <api-key>
```

### Test Provider Connection

```http
POST /api/v1/provider/configs/{providerId}/test
Authorization: Bearer <api-key>
```

**Response**:
```json
{
  "success": true,
  "latencyMs": 245,
  "modelCount": 15,
  "testedAt": "2026-10-02T12:00:00Z"
}
```

### Refresh Model Catalog

```http
POST /api/v1/provider/configs/{providerId}/models
Authorization: Bearer <api-key>
Content-Type: application/json

{
  "requestId": "req_abc123"
}
```

**Response**:
```json
{
  "catalogVersion": 4,
  "modelsAdded": 2,
  "modelsUpdated": 3,
  "totalModels": 17,
  "refreshedAt": "2026-10-02T12:00:00Z"
}
```

### List Models

```http
GET /api/v1/provider/configs/{providerId}/models
Authorization: Bearer <api-key>
```

**Query Parameters**:
- `capability`: Filter by capability (e.g., `text`)
- `enabled`: Filter by enabled status (`true`/`false`)
- `limit`: Results per page (default: 50)
- `offset`: Pagination offset

**Response**:
```json
{
  "models": [
    {
      "modelId": "gpt-4",
      "providerId": "provider_abc123",
      "displayName": "GPT-4",
      "capabilities": ["text", "multimodal"],
      "enabled": true,
      "isDefault": false,
      "metadata": {
        "contextLength": 8192,
        "pricing": {
          "inputTokens": 0.03,
          "outputTokens": 0.06
        }
      }
    }
  ],
  "total": 17,
  "limit": 50,
  "offset": 0
}
```

### Update Model Policy

```http
POST /api/v1/provider/configs/{providerId}/model-policies
Authorization: Bearer <api-key>
Content-Type: application/json

{
  "modelId": "gpt-4",
  "capabilities": ["text"],
  "enabled": true,
  "isDefault": false,
  "quotaPolicy": {
    "maxTokensPerRequest": 4096,
    "maxRequestsPerDay": 1000
  }
}
```

---

## Task Execution API

### Submit Task

```http
POST /api/v1/tasks
Authorization: Bearer <api-key>
Content-Type: application/json

{
  "modelId": "gpt-4",
  "providerId": "provider_abc123",
  "prompt": "Hello, world!",
  "parameters": {
    "temperature": 0.7,
    "maxTokens": 1000,
    "stopSequences": ["\n\n"]
  }
}
```

**Response**:
```json
{
  "taskId": "task_abc123",
  "status": "pending",
  "createdAt": "2026-10-02T12:00:00Z"
}
```

### Get Task Status

```http
GET /api/v1/tasks/{taskId}
Authorization: Bearer <api-key>
```

**Response**:
```json
{
  "taskId": "task_abc123",
  "status": "completed",
  "modelId": "gpt-4",
  "providerId": "provider_abc123",
  "createdAt": "2026-10-02T12:00:00Z",
  "startedAt": "2026-10-02T12:00:01Z",
  "completedAt": "2026-10-02T12:00:10Z",
  "usage": {
    "promptTokens": 15,
    "completionTokens": 150,
    "totalTokens": 165
  },
  "artifactId": "artifact_xyz789"
}
```

### Stream Task Results (SSE)

```http
GET /api/v1/tasks/{taskId}/stream
Authorization: Bearer <api-key>
Accept: text/event-stream
```

**SSE Events**:

**Data Event**:
```
event: data
data: {"delta": "Hello", "index": 0}
```

**Progress Event**:
```
event: progress
data: {"tokensGenerated": 50, "elapsedMs": 2500}
```

**Complete Event**:
```
event: complete
data: {"taskId": "task_abc123", "artifactId": "artifact_xyz789", "usage": {...}}
```

**Error Event**:
```
event: error
data: {"code": "PROVIDER_ERROR", "message": "Provider timeout"}
```

### Get Task Artifact

```http
GET /api/v1/tasks/{taskId}/artifact
Authorization: Bearer <api-key>
```

**Response**:
```json
{
  "artifactId": "artifact_xyz789",
  "taskId": "task_abc123",
  "content": "Hello! How can I help you today?",
  "mimeType": "text/plain",
  "size": 35,
  "createdAt": "2026-10-02T12:00:10Z"
}
```

### Cancel Task

```http
POST /api/v1/tasks/{taskId}/cancel
Authorization: Bearer <api-key>
```

### List Tasks

```http
GET /api/v1/tasks
Authorization: Bearer <api-key>
```

**Query Parameters**:
- `status`: Filter by status (`pending`, `running`, `completed`, `failed`, `cancelled`)
- `modelId`: Filter by model
- `providerId`: Filter by provider
- `limit`: Results per page (default: 20)
- `offset`: Pagination offset

---

## Package Management API

### List Packages

```http
GET /api/v1/packages
Authorization: Bearer <api-key>
```

**Query Parameters**:
- `installed`: Filter installed packages (`true`/`false`)
- `category`: Filter by category
- `search`: Search query

**Response**:
```json
{
  "packages": [
    {
      "packageId": "pkg_abc123",
      "name": "dgos-ai-workbench",
      "displayName": "DGOS AI Workbench",
      "version": "1.0.0",
      "category": "productivity",
      "installed": true,
      "activeVersion": "1.0.0",
      "updateAvailable": false
    }
  ]
}
```

### Install Package

```http
POST /api/v1/packages/{packageId}/install
Authorization: Bearer <api-key>
Content-Type: application/json

{
  "version": "1.0.0",
  "approvePermissions": true
}
```

**Response**:
```json
{
  "installationId": "install_abc123",
  "status": "installing",
  "packageId": "pkg_abc123",
  "version": "1.0.0"
}
```

### Get Installation Status

```http
GET /api/v1/packages/installations/{installationId}
Authorization: Bearer <api-key>
```

### Uninstall Package

```http
POST /api/v1/packages/{packageId}/uninstall
Authorization: Bearer <api-key>
Content-Type: application/json

{
  "deleteUserData": false
}
```

### Get Package Details

```http
GET /api/v1/packages/{packageId}
Authorization: Bearer <api-key>
```

---

## Extension Management API

### List Extensions

```http
GET /api/v1/extensions
Authorization: Bearer <api-key>
```

**Response**:
```json
{
  "extensions": [
    {
      "extensionId": "ext_abc123",
      "name": "weather-extension",
      "displayName": "Weather Extension",
      "version": "1.0.0",
      "enabled": true,
      "status": "active",
      "capabilities": ["skill", "mcp"]
    }
  ]
}
```

### Install Extension

```http
POST /api/v1/extensions
Authorization: Bearer <api-key>
Content-Type: multipart/form-data

file: <extension-package>
```

### Enable/Disable Extension

```http
PATCH /api/v1/extensions/{extensionId}
Authorization: Bearer <api-key>
Content-Type: application/json

{
  "enabled": true
}
```

### Configure Extension

```http
PUT /api/v1/extensions/{extensionId}/config
Authorization: Bearer <api-key>
Content-Type: application/json

{
  "apiKey": "...",
  "endpoint": "https://api.example.com",
  "timeout": 30000
}
```

### Uninstall Extension

```http
DELETE /api/v1/extensions/{extensionId}
Authorization: Bearer <api-key>
```

---

## Audit Log API

### List Audit Events

```http
GET /api/v1/audit/events
Authorization: Bearer <api-key>
```

**Query Parameters**:
- `startDate`: ISO 8601 timestamp
- `endDate`: ISO 8601 timestamp
- `eventType`: Filter by event type
- `principalId`: Filter by principal
- `resourceType`: Filter by resource type
- `limit`: Results per page (default: 50)
- `offset`: Pagination offset

**Response**:
```json
{
  "events": [
    {
      "eventId": "event_abc123",
      "eventType": "task.created",
      "principalId": "principal_xyz",
      "resourceType": "task",
      "resourceId": "task_abc123",
      "action": "create",
      "success": true,
      "timestamp": "2026-10-02T12:00:00Z",
      "metadata": {
        "modelId": "gpt-4",
        "providerId": "provider_abc123"
      }
    }
  ],
  "total": 1500,
  "limit": 50,
  "offset": 0
}
```

### Get Audit Event

```http
GET /api/v1/audit/events/{eventId}
Authorization: Bearer <api-key>
```

---

## Rate Limiting

**Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1696252800
```

**Rate Limits**:
- API calls: 100 requests per minute
- Task submissions: 10 per minute
- Provider operations: 20 per minute

---

## Pagination

**Request**:
```http
GET /api/v1/tasks?limit=20&offset=40
```

**Response Headers**:
```
X-Total-Count: 150
Link: </api/v1/tasks?limit=20&offset=60>; rel="next",
      </api/v1/tasks?limit=20&offset=20>; rel="prev"
```

---

## Versioning

**Current Version**: `v1`  
**API Prefix**: `/api/v1`

All V1 endpoints are stable and will not introduce breaking changes. Future versions will use `/api/v2`, etc.

---

## Webhook Support

⚠️ **Not Available in V1** - Planned for V2

---

**For code examples and SDKs:**
- [Developer Guide](../../06-用户文档/V1-Developer-Guide.md)
- [Integration Examples](../04-技术架构/集成指南.md)
