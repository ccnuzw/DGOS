# V1 Wave 1 执行计划

**创建日期**: 2026-10-02  
**Lead**: 本会话  
**目标**: 解除 V1 发布的 P0 阻塞器

## Wave 1 目标

解除 3 个硬阻塞：
1. Native bridge 超时 → 桌面端完全不可用
2. 镜像安全漏洞 → 1 Critical + 59 High CVEs
3. E2E-10 失败 → 核心会话管理验证不通过

同时接入真实 Provider，消除所有 AI 功能的 fixture 依赖。

## 工作包清单

### WP-W1-01: Native Bridge 诊断与修复
- **Owner**: Worker-F
- **Priority**: P0 - Critical Path
- **Estimated**: 5-7 天
- **Mode**: implementation + verification

**Objective**: 定位并修复 Tauri iframe sandbox 注入失败根因

**Scope**:
- 诊断 `.herdr/V1-NATIVE-EXECUTION-r14.md` 中的 `webview_result_timeout`
- 验证 iframe load/injected 事件链
- 测试不同沙箱策略配置
- 修复注入时序或调整沙箱级别（需安全评审）

**Allowed Paths**:
- `apps/desktop/scripts/workbench-main-driver.js`
- `apps/desktop/scripts/workbench-frame-driver.js`
- `apps/desktop/scripts/candidate-preflight.mjs`
- `apps/desktop/src-tauri/src/*`
- `apps/desktop/src-tauri/capabilities/*`
- `.herdr/V1-NATIVE-*.md`

**Forbidden Paths**:
- `apps/web/src/*` (前端不变)
- `apps/web/dist/*` (使用当前 dist)
- `migrations/*` (数据库不变)

**Dependencies**: 无

**Acceptance**:
1. 签名 Workbench (1.0.1/build2) 启动后 iframe 能收到 injected 事件
2. 完整 Task 提交 → SSE 流式 → Artifact 读取链路通过
3. E2E-01 从 Blocked 变为 Passed
4. 至少一次真实前台 manifest 包含完整 stageHistory 和 Task/Artifact 证据
5. 如调整沙箱策略，必须附带安全影响评估

**Commands**:
```bash
node apps/desktop/scripts/candidate-preflight.mjs
node scripts/v1-desktop-real.mjs
node --check <changed files>
```

**Writeback**:
- `.herdr/V1-NATIVE-BRIDGE-FIX-r1.md`
- `.herdr/V1-NATIVE-*-manifest.json` (新批次)
- `docs/02-产品与版本/当前版本/V1-实现状态.md` (FR-001 状态)

**Known Context**:
- r13/r14 已确认 iframe 资源已连接/加载，窗口可见
- 超时发生在宿主握手或 driver 结果写入前
- 当前 dist 已签名，不要重新构建除非必要

---

### WP-W1-02: 镜像安全修复
- **Owner**: Worker-B (主), Worker-I (协作)
- **Priority**: P0
- **Estimated**: 3-5 天
- **Mode**: implementation + verification

**Objective**: 消除镜像 1 Critical + 59 High CVEs，达到发布安全门禁

**Scope**:
- 获取 Docker Scout 认证或安装 Trivy
- 升级 Debian trixie 基础镜像的可升级依赖
- 对无修复版本的 CVE-2026-6653 libxml2 提交安全豁免申请
- 重新构建并扫描镜像

**Allowed Paths**:
- `deployment/Dockerfile`
- `deployment/*.production.yml`
- `docker-compose.yml`
- `.herdr/V1-IMAGE-SECURITY-*.md`
- `docs/05-测试与发布/发布/安全扫描报告.md`

**Forbidden Paths**:
- `src/*` (应用代码不变)
- `migrations/*` (数据库不变)

**Dependencies**: Docker daemon 可用

**Acceptance**:
1. 获得镜像扫描工具认证或成功运行 Trivy
2. 新镜像扫描结果 ≤ 5 High CVEs (Critical = 0)
3. 对无法修复的 CVE 有书面豁免申请（包含影响面分析）
4. 新镜像通过 runtime canary 测试
5. 发布门禁 security 相关错误从 10 降到 ≤2

**Commands**:
```bash
docker build -f deployment/Dockerfile -t dgos:v1-candidate .
docker scout cves dgos:v1-candidate  # 或 trivy image dgos:v1-candidate
docker run --rm dgos:v1-candidate /healthcheck
```

**Writeback**:
- `.herdr/V1-IMAGE-SECURITY-r11.md`
- `docs/05-测试与发布/发布/V1-安全扫描报告-2026-10-02.md`
- 镜像 SHA256 绑定到候选清单

---

### WP-W1-03: E2E-10 修复
- **Owner**: Worker-C
- **Priority**: P0
- **Estimated**: 2-3 天
- **Mode**: implementation + verification

**Objective**: 修复 E2E-10 并发会话测试的 3/6 失败项

**Scope**:
1. 授权作用域拒绝返回 403 而非 500
   - 检查 scope 验证中间件错误处理
2. 会话访问控制返回 201 而非 422
   - 检查 provider account 创建的请求验证逻辑
   - 修复参数映射 (protocol→protocolType, label→displayName, endpoint→scope.endpoint)
3. 速率限制触发
   - 检查速率限制器配置和时钟依赖

**Allowed Paths**:
- `apps/api/src/identity-service.mjs`
- `apps/api/src/identity-routes.mjs`
- `apps/api/src/provider-routes.mjs`
- `src/security/rate-limiter.mjs`
- `tests/security/v1-auth-authz.test.mjs`
- `.herdr/V1-E2E-10-FIX-r1.md`

**Forbidden Paths**:
- `migrations/*` (数据库不变)
- `apps/web/src/*` (前端不变)

**Dependencies**: 
- PostgreSQL 可用
- Redis 可用

**Acceptance**:
1. `tests/security/v1-auth-authz.test.mjs` 全部通过 (当前 3/6)
2. "Authorization - insufficient scope rejected" 返回 403 + errorKey='insufficient_scope'
3. "Authorization - session-based access control" 返回 201 Created
4. "Rate limiting - login attempts limited" 返回 429 Too Many Requests
5. E2E-10 用例矩阵从 "⚠️ 部分通过 (3/6)" 变为 "✅ 完全通过 (6/6)"

**Commands**:
```bash
node --test tests/security/v1-auth-authz.test.mjs
pnpm run test:integration  # 回归验证
```

**Writeback**:
- `.herdr/V1-E2E-10-FIX-r1.md`
- `docs/05-测试与发布/端到端验收/用例矩阵.md` (E2E-10 状态)
- `docs/02-产品与版本/当前版本/V1-实现状态.md` (FR-010 状态)

---

### WP-W1-04: 真实 Provider 最小接入
- **Owner**: Worker-H
- **Priority**: P0
- **Estimated**: 3-4 天
- **Mode**: implementation + verification

**Objective**: 接入一个真实 OpenAI-compatible Provider，消除 fixture 依赖

**Scope**:
- 配置真实 API endpoint (如 OpenAI/Anthropic/etc)
- 验证 TLS/DNS/CA 真实环境行为
- 执行完整 text task 链路：配置 → 模型刷新 → task 提交 → 配额结算
- 记录真实 API 调用、错误处理、超时恢复

**Allowed Paths**:
- `src/provider/*`
- `src/provider-adapters/*`
- `tests/provider/*`
- `scripts/v1-provider-real.mjs` (新建)
- `.herdr/V1-PROVIDER-REAL-r1.md`

**Forbidden Paths**:
- `migrations/*` (数据库不变)
- `apps/web/src/*` (UI 后续 Wave 2)

**Dependencies**: 
- 用户提供真实 API Key (OpenAI 或兼容服务)
- PostgreSQL + Redis 可用

**Acceptance**:
1. 至少一个真实 OpenAI-compatible provider 配置成功
2. 模型列表刷新返回真实模型 (不是 fixture)
3. 提交真实 text task 成功完成，包含：
   - Task 状态正确转换 (pending → running → completed)
   - SSE 流式输出至少一个 delta
   - Artifact 正确保存
4. 配额正确预留和结算 (usage 非零)
5. 真实 TLS 证书验证通过
6. 错误场景验证：API Key 无效返回清晰错误

**Commands**:
```bash
node scripts/v1-provider-real.mjs --provider=openai-compatible
node --test tests/provider/real-provider-integration.test.mjs
```

**Writeback**:
- `.herdr/V1-PROVIDER-REAL-r1.md`
- `tests/provider/evidence/V1-PROVIDER-REAL-*.json` (manifest)
- `docs/02-产品与版本/当前版本/V1-实现状态.md` (FR-005/007 真实 Provider 标记)

**Security Notes**:
- 真实 API Key 不进入报告/日志
- 使用环境变量 `DGOS_REAL_PROVIDER_KEY`
- 测试完成后撤销测试用 Key

---

### WP-W1-05: Wave 1 文档收敛
- **Owner**: Planner
- **Priority**: P0
- **Estimated**: 1-2 天
- **Mode**: specification

**Objective**: 为 Wave 1 的 4 个工作包生成任务包和上下文

**Scope**:
- 读取当前诊断报告和相关文档
- 为 WP-W1-01 到 WP-W1-04 生成 context-pack
- 明确依赖关系和验收标准
- 准备文档回写路径
- 执行 `review-docs` 确认受影响文档 Ready

**Allowed Paths**:
- `.herdr/*`
- `docs/01-项目概览/*`
- `docs/02-产品与版本/当前版本/*`
- `docs/03-功能规格/V1/*`
- `docs/05-测试与发布/*`

**Forbidden Paths**:
- `src/*` (不修改代码)
- `migrations/*` (不修改数据库)

**Dependencies**: 无

**Acceptance**:
1. 4 个工作包的 context-pack 生成完毕
2. 每个 context-pack 包含：
   - 权威文档列表
   - 当前实现状态摘要
   - 验收标准映射
   - 依赖关系
3. Wave 1 依赖图清晰（4 个工作包可并行）
4. 回写路径明确，无冲突
5. `review-docs` 通过，无结构性错误

**Commands**:
```bash
node scripts/check-docs.mjs
# spec-docs skill 调用 (如果可用)
```

**Writeback**:
- `.herdr/V1-WAVE1-CONTEXT-PACKS.md`
- `.herdr/delivery-board.yaml` (更新 Wave 1 状态)

---

## Wave 1 协调规则

### 并行约束
- 所有 5 个工作包可以并行执行
- 无代码路径冲突
- 数据库和 migration 均不修改

### 整合点
- Worker-F/C/H 各自独立验证
- Worker-B/I 镜像扫描结果统一回写
- Planner 在 Worker 开始前提供 context-pack

### 沟通规则
- Worker 发现阻塞立即报告 Lead
- 需要用户输入 (如真实 API Key) 时通过 Lead 请求
- 每日进度更新到 `delivery-board.yaml`

### 验收标准
Wave 1 完成条件：
1. ✅ Native bridge 修复，E2E-01 通过
2. ✅ 镜像安全 ≤5 High CVEs
3. ✅ E2E-10 从 3/6 变为 6/6
4. ✅ 至少一个真实 Provider 接入成功
5. ✅ 所有 Worker 报告提交，证据完整

## 下一步
Wave 1 完成后立即启动 Wave 2 (UI 证据补齐)。
