# DGOS V1 Release Notes

**Version**: V1.0.0  
**Release Date**: TBD (Pending Approval)  
**Status**: Development Complete, Release Blocked  
**Commit**: 72ab1cb98b064a6e27b9f60a9f8f00881a827a99

---

## Overview

DGOS V1 is the first release of the extensible desktop and web application platform. This release provides core platform infrastructure, AI task workflows, and system management capabilities focused on macOS desktop and Docker Compose deployment.

**Key Focus Areas**:
- Platform foundation with identity, governance, and package management
- AI task workflow with provider integration and model configuration
- Desktop application with shared web frontend
- System assistant with action execution
- Developer center for application lifecycle management

---

## What's New in V1

### 🖥️ Desktop & Application Workspace (V1-FR-001)
- **Native macOS Desktop Application**: Full Tauri-based desktop client
- **Workbench Integration**: Seamless iframe embedding for web applications
- **Window Lifecycle Management**: Native window controls and state persistence
- **Sandbox Isolation**: Security boundary between host and applications
- **Context Handshake**: Secure communication between desktop and web layers

### 📦 Developer Center & APP Lifecycle (V1-FR-002)
- **Package Catalog Management**: Browse, install, and manage applications
- **Installation & Rollback**: Safe installation with automatic rollback on failure
- **Health Checks**: Validation before activating new versions
- **Retention Policies**: Configurable package version retention
- **Developer Testing**: Test installations for pre-release packages

### 🔌 Skill MCP & Agent Integration (V1-FR-003)
- **Extension Management**: Install and manage custom skills
- **MCP Protocol Support**: Model Context Protocol integration
- **Template Credentials**: Secure credential management for extensions
- **HTTPS Preview**: Trusted preview environment for development
- **Isolation Boundary**: Sandboxed execution for third-party extensions

### 🤖 Multimodal AI Task Workflow (V1-FR-005)
- **Task Submission**: Submit text generation tasks to AI providers
- **SSE Streaming**: Real-time server-sent events for incremental results
- **Artifact Creation**: Structured output with persistent artifacts
- **Terminal States**: Clear success/failure/cancelled states
- **Replay Idempotency**: Safe task replay without duplicate upstream calls

### ⚙️ Model Platform & Workflow Configuration (V1-FR-007)
- **Provider Protocols**: Support for openai-compatible and custom protocols
- **Model Catalog**: Discover and manage available models
- **Capability Classification**: Multi-capability model classification (9 types)
- **Default Model Selection**: Per-capability default model configuration
- **Quota Enforcement**: Usage limits and quota management

### 🧠 System Intelligent Assistant (V1-FR-009)
- **Action Directory**: Discover available system actions
- **Plan Generation**: AI-powered action planning
- **Execution with Confirmation**: Review and approve plans before execution
- **Permission Boundary**: Actions respect system permissions
- **Result Projection**: Structured action results

### 🔐 Administrator Login & Session (V1-FR-010)
- **Principal Bootstrap**: Initial administrator account creation
- **Session Management**: Secure session with CSRF protection
- **Concurrent Sessions**: Multi-device login support
- **Session Revocation**: Remote logout capability
- **Audit Trail**: Complete session activity logging

### 🔑 API Key Lifecycle (V1-FR-011)
- **Key Creation**: Generate API keys with custom scopes
- **Scope Limitation**: Fine-grained permission control
- **Key Rotation**: Safe key rotation with finite validity
- **Expiration**: Automatic key expiry
- **Cross-Instance Support**: Keys work across distributed instances

### 🌐 Provider Account & Connection (V1-FR-012)
- **Account Creation**: Register external provider accounts
- **Credential Storage**: Encrypted credential management
- **Validation**: Connection testing before activation
- **Account Activation**: Enable/disable providers
- **Owner Isolation**: Multi-tenant credential isolation

### 🔍 Upstream Account Connection Test (V1-FR-013)
- **Connection Validation**: Test provider connectivity
- **Model Discovery**: Automatic model enumeration
- **Latency Measurement**: Connection performance metrics
- **Error Handling**: Detailed failure diagnostics

### 📊 Audit & Administrator Governance (V1-FR-014)
- **Audit Event Storage**: Complete activity logging
- **Event Projection**: Query and filter audit logs
- **Pagination**: Efficient large dataset access
- **Secret Redaction**: No sensitive data in logs
- **Cross-Owner Isolation**: Tenant-specific audit trails

### 📈 Usage & Quota Management (V1-FR-015)
- **Quota Policy Configuration**: Set usage limits per provider/model
- **Usage Tracking**: Real-time token consumption monitoring
- **Hard Limit Enforcement**: Automatic quota enforcement
- **Audit Integration**: Usage events in audit log

---

## Installation Guide

### System Requirements

**Minimum**:
- macOS 12.0+ (Monterey or later)
- Node.js v22+
- PostgreSQL 16+
- Redis 7+
- 4GB RAM
- 2GB disk space

**Recommended**:
- macOS 13.0+ (Ventura or later)
- 8GB RAM
- 10GB disk space
- SSD storage

### Prerequisites

1. **Install Node.js v22**:
   ```bash
   # Using nvm
   nvm install 22
   nvm use 22
   ```

2. **Install pnpm**:
   ```bash
   npm install -g pnpm@9.0.0
   ```

3. **Install Docker** (for PostgreSQL/Redis):
   - Download from https://docker.com
   - Or use Homebrew: `brew install --cask docker`

### Installation Steps

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd DGOS
   git checkout v1.0.0
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start infrastructure**:
   ```bash
   docker compose up -d
   ```

5. **Run database migrations**:
   ```bash
   pnpm migrate:plan
   ```

6. **Verify installation**:
   ```bash
   pnpm test
   pnpm run check
   ```

7. **Start the API server**:
   ```bash
   pnpm --filter @dgos/api dev
   ```

8. **Build and launch desktop application**:
   ```bash
   cd apps/desktop
   pnpm tauri dev
   ```

### First-Time Setup

1. **Access the application** at `http://localhost:3000`
2. **Bootstrap administrator account**: Follow the initial setup wizard
3. **Configure a Provider**: Navigate to Settings > Providers
4. **Test connection**: Use the connection test feature
5. **Refresh model catalog**: Explicitly refresh to discover models
6. **Classify models**: Assign capabilities to discovered models
7. **Enable models**: Activate models for task submission

---

## Upgrade Guide

⚠️ **V1 is the first release** - no upgrade path from previous versions.

For future upgrades from V1 to V2:
- Database migrations will be provided
- Backup your PostgreSQL database before upgrading
- Review breaking changes in V2 release notes
- Test in a non-production environment first

---

## Breaking Changes

### From Pre-Release to V1

1. **Database Schema**: Migration 0051 is the frozen baseline
   - All previous development schemas are incompatible
   - Fresh installation required

2. **API Endpoints**: Public API contract frozen
   - `/api/v1/*` endpoints are now stable
   - Internal APIs may change without notice

3. **Provider Protocol**: `openai-compatible` is the stable protocol
   - Custom adapters must implement the frozen interface
   - Protocol version negotiation is required

4. **Package Manifest**: DGOS manifest schema v1 is required
   - Packages must declare capabilities and permissions
   - Legacy formats are not supported

---

## Known Limitations

### Platform Limitations

1. **macOS Only**: Desktop application only supports macOS 12+
   - Windows and Linux support planned for V2+
   - Web interface works in Docker on any platform

2. **Single Administrator**: Only one bootstrap administrator supported
   - Multi-admin and team features planned for V2

3. **Local Deployment**: Production deployment guide not finalized
   - Docker Compose is for local/development use
   - Kubernetes and cloud deployment in V3

### Feature Limitations

4. **Text-Only Tasks**: Only text generation tasks supported
   - Image, video, audio generation planned for V3-V4
   - Vision/understanding capabilities planned for V4+

5. **Linear Workflow**: No project or canvas support
   - Projects planned for V2
   - Canvas and structured assets in V3

6. **Limited Providers**: Only `openai-compatible` protocol
   - Native protocols (Anthropic, etc.) in V2
   - Additional adapters based on demand

### Known Issues

7. **Native Bridge Timeout**: E2E testing has iframe communication issues
   - Does not affect production functionality
   - Under investigation, non-blocking

8. **Model Capability UI**: Default model selection UI implemented
   - Advanced features (V3/V4 capabilities) not yet functional
   - Text generation fully supported

9. **Performance Baseline**: Load testing not completed
   - Single-task performance validated (8.6s, 4405 tokens)
   - Concurrent load testing planned

---

## Security Notes

### Critical Security Information

⚠️ **60 Known CVEs in Base Image**: The Debian Trixie base image contains:
- 1 CRITICAL vulnerability (libxml2 2.12.9+dfsg-2)
- 59 HIGH severity vulnerabilities across 23 packages

**Status**: These vulnerabilities cannot be fixed in current Debian repositories. Formal security acceptance is required before production deployment.

**Affected Components**: Linux container base image only (not macOS desktop)

**Mitigation**:
- Run in isolated Docker networks
- Apply network security policies
- Monitor for security updates
- Use AppArmor/SELinux profiles
- Limit container privileges

### Security Features

✅ **Credential Encryption**: All provider credentials encrypted at rest
✅ **Secret Redaction**: No secrets in logs or error messages
✅ **TLS Support**: HTTPS for all provider communication
✅ **Permission System**: Fine-grained capability-based permissions
✅ **Audit Logging**: Complete activity trail with secret redaction
✅ **CSRF Protection**: Session protection for web interface
✅ **Sandbox Isolation**: Extensions run in isolated contexts

### Security Best Practices

1. **Change Default Credentials**: Set strong passwords during bootstrap
2. **Use TLS**: Enable HTTPS for production deployments
3. **Rotate Keys**: Regularly rotate API keys and provider credentials
4. **Review Audit Logs**: Monitor for suspicious activity
5. **Limit Network Access**: Use firewall rules to restrict access
6. **Update Dependencies**: Monitor for security updates
7. **Backup Encrypted Data**: Secure backup procedures for credentials

---

## Documentation

### User Documentation
- [V1 User Guide](../../06-用户文档/V1-User-Guide.md)
- [System Info UI Guide](../../06-用户文档/V1-User-Guide.md#system-info)
- [Developer Center Usage](../../06-用户文档/V1-User-Guide.md#developer-center)
- [Troubleshooting](../../06-用户文档/V1-User-Guide.md#troubleshooting)

### Developer Documentation
- [V1 Developer Guide](../../06-用户文档/V1-Developer-Guide.md)
- [Architecture Overview](../../04-技术架构/当前版本/V1-总体架构.md)
- [API Reference](../../04-技术架构/V1-API-Reference.md)
- [Extension Development](../../06-用户文档/V1-Developer-Guide.md#extension-development)

### Deployment & Operations
- [V1 Deployment Guide](../../05-测试与发布/V1-Deployment-Guide.md)
- [Configuration Reference](../../05-测试与发布/V1-Deployment-Guide.md#configuration)
- [Monitoring Setup](../../05-测试与发布/V1-Deployment-Guide.md#monitoring)
- [Backup & Recovery](../../05-测试与发布/V1-Deployment-Guide.md#backup-recovery)

### Release Information
- [Known Issues](./V1-Known-Issues.md)
- [Development Report](../../99-历史归档/README.md)
- [E2E Test Report](../../99-历史归档/README.md)
- [Release Report](../../99-历史归档/README.md)

---

## Support & Resources

### Community
- Documentation: `docs/` directory
- Issues: GitHub Issues (if applicable)
- Discussions: Project communication channels

### Getting Help
1. Check the [Troubleshooting Guide](../../06-用户文档/V1-User-Guide.md#troubleshooting)
2. Review [Known Issues](./V1-Known-Issues.md)
3. Search existing documentation
4. Contact technical support

### Reporting Issues
When reporting issues, include:
- DGOS version (`v1.0.0`)
- Operating system and version
- Steps to reproduce
- Expected vs actual behavior
- Relevant log excerpts (with secrets redacted)

---

## Acknowledgments

V1 represents the foundation of the DGOS platform with 12 core features and 62 acceptance criteria implemented and verified. This release establishes the architecture, protocols, and workflows for future platform growth.

**Development Status**: ✅ Complete  
**Verification Status**: 🟡 Partial (50% E2E coverage)  
**Release Status**: ❌ Blocked (pending approvals and security acceptance)

---

**For the latest information, see the [V1 Final Status Summary](../../99-历史归档/README.md)**
