# ADR-0007 V1 秘密管理与 Provider 出站安全

- 状态：Accepted
- 日期：2026-10-01
- 决策人角色：安全负责人、技术负责人、Provider 负责人
- 关联需求/决策：`D018`、`D019`、`D025`、`V1-FR-007`、`V1-FR-011`–`V1-FR-013`
- 前置决策：[ADR-0003](0003-V1技术栈与可替换运行时.md)、[ADR-0005](0005-V1身份秘密Provider治理与用量机器契约.md)

## 背景

V1 同时处理管理员认证材料、DGOS API Key、Provider 凭据和代理凭据。桌面本地模式有系统钥匙串，Web/服务端模式有数据库和 KMS/密钥管理服务，Provider 连接测试还涉及用户可配置的外部地址。若不统一秘密根、短时访问和出站网络检查，秘密可能进入日志、前端、普通 API 响应，或被利用进行 SSRF。

本文冻结秘密访问和 Provider 出站安全边界，不表示 Secret backend、KMS、网络组件或安全测试已经实现。

## 决策

### 1. Secret Service 是唯一明文拥有者

1. Secret Service 负责写入、读取、轮换、撤销、版本和访问审计；Identity、Provider Account、ProviderConfig、Adapter 和 extension-runner 只保存 `SecretRef` 或脱敏状态。
2. 浏览器、桌面前端、普通 APP 和 OpenAPI 列表接口永远不能读取明文 Secret。一次性展示只适用于 DGOS API Key 创建/轮换成功响应，且由调用方提交后立即失效。
3. Secret 按用途、主体和环境分域；Provider 凭据不得作为管理员登录凭据或 DGOS API Key 复用。
4. Secret 读取必须返回短时、最小权限、绑定用途和调用 requestId 的句柄；Adapter 使用句柄读取，调用完成或 TTL 到期后失效。
5. 日志、错误、审计、SSE、测试报告、数据库业务表、导出和 crash dump 不得出现密码、Cookie、Token、Authorization、完整 API Key、代理认证信息或上游原始 body。

### 2. 存储与密钥根

| 运行模式 | Secret backend | 密钥根规则 | 失败行为 |
| --- | --- | --- | --- |
| macOS 桌面 | 系统钥匙串适配器 | 根密钥由宿主钥匙串保护；应用只获得受控 Secret Service 调用 | 钥匙串不可用时 fail closed，不降级到明文文件 |
| Docker Web 本地/服务器 | KMS/外部 Secret backend 优先；开发夹具可使用明确标记的本地加密 backend | 数据密钥由部署侧根密钥包裹；根密钥不进镜像、仓库或 PostgreSQL | backend 不可用时禁止创建 ready 账号、API Key 或 Provider 连接 |
| 测试夹具 | 临时隔离 backend | 每次运行生成，运行结束销毁 | 不允许使用生产 Secret 或真实凭据 |

环境变量只允许注入 Secret backend 的启动配置或开发测试夹具，不能作为产品默认的 Provider/API Key 持久化方案。轮换采用新版本先写入并验证，再切换引用，旧版本按显式窗口失效；写入或验证失败不得撤销唯一可用旧版本。

### 3. 认证与传输

- Web 管理员会话使用 HTTPS；会话凭据采用 `Secure`、`HttpOnly`、适当 `SameSite` 和短期访问期限，续期凭据可撤销、轮换并绑定会话版本。具体 cookie 名称和 CSRF 机制由实现 schema 冻结。
- 桌面前端不持有 Provider/API Key；Tauri 宿主只提供钥匙串适配能力，业务请求仍走同一套 DGOS API 语义。
- API Key 只以一次性创建/轮换响应返回；持久化保存 digest/SecretRef/prefix/状态，不保存可恢复明文。
- 认证、Secret 解析和 Provider 请求超时必须有明确上限；超时不以缓存的旧授权或旧凭据伪造成功。

### 4. Provider 出站组件

所有 Provider 验证、连接测试、模型刷新和 AI Task 上游调用必须经过统一的 `ProviderEgress` 组件和已发布 `ProviderAdapter`。浏览器、桌面前端、APP 和 extension-runner 不得直接访问 Provider URL。

`ProviderEgress` 在建立连接前必须完成：

1. 只允许已发布 Adapter 声明的协议和请求模板；拒绝任意 method、path、header、query 或 body 拼接。
2. 只允许 `https`；`http` 仅能在明确标记的本地测试夹具中开启，生产配置拒绝。
3. 规范化 host、端口和路径，拒绝 userinfo、非标准编码、嵌入凭据和未声明端口。
4. DNS 解析全部候选地址并校验 IP；默认拒绝 loopback、link-local、私网、保留地址、Unix socket、云元数据地址和未允许的本地网段。
5. 连接建立和每次重定向都重新解析和校验目标；默认不跟随重定向。若 Adapter 声明允许有限重定向，只能保持同一允许 host 集合，禁止凭据跨 host 转发。
6. 执行 TLS 证书和主机名校验，设置连接、读取、总时限和响应大小上限；禁止无限流、无限 body 和无限重试。
7. 出站策略检查在 Secret 句柄取得和网络请求之前完成；被阻止时不得泄露解析到的内部 IP、完整 URL 或凭据状态细节。

部署管理员如需访问受控内部 Provider，必须显式配置 host/CIDR allowlist、端口、协议和用途。allowlist 不得使任意用户输入 URL 获得通配访问；每次策略改变需版本化并审计。

### 5. 连接测试与 ProviderConfig 验证分离

- `startProviderConnectionTest` 只调用 Adapter 声明的最小探测，不刷新模型目录、不启用模型、不创建 AI Task。
- `validateProviderConfig` 和 `refreshProviderModels` 是独立 operation；连接测试成功不能直接把 ProviderConfig 标记为 active。
- 探测结果只保留稳定分类、协议/配置版本、endpoint 指纹、耗时和脱敏摘要；不保存 query、Authorization、原始 body 或完整上游响应。
- 非幂等探测默认不自动重试；安全且幂等的连接建立可按 Adapter 预算有限重试。

## 稳定安全分类

对外只允许稳定分类：`policy_blocked`、`endpoint_invalid`、`tls_invalid`、`network_unreachable`、`authentication_failed`、`rate_limited`、`protocol_mismatch`、`upstream_unavailable`、`timed_out`、`cancelled` 和 `credential_unavailable`。内部 DNS、IP、证书链、供应商 body 和栈信息只进入受控安全诊断，不进入普通响应或审计。

## 不采用的方案

### 方案 A：把 Provider Key 放在应用数据库或环境变量中

不采用。容易被备份、日志、配置导出或进程诊断带出，且无法实现按用途、版本和访问时限控制。

### 方案 B：由前端直接调用 Provider

不采用。无法统一 SSRF、凭据、超时、错误脱敏、审计和模型策略边界。

### 方案 C：只在首次保存 URL 时做一次 SSRF 检查

不采用。DNS 变化、重定向和连接重试可能把同一名称解析到禁止地址，检查必须在每次出站连接和重定向时执行。

## 后果

- Secret、Provider Account、ProviderConfig 和 Adapter 的职责边界明确，桌面/Web 可以使用不同 backend 但保持相同公共语义。
- 出站策略成为所有 Provider 网络动作的单一入口，连接测试和模型刷新可复用安全组件。
- 需要维护密钥根、句柄 TTL、allowlist、DNS 解析器和受控诊断基础设施；这些成本不能通过把安全检查下放给前端来消除。
- 本 ADR 不冻结具体 KMS 厂商、加密库、cookie 名称、DNS 库或网络代理产品；实现选择必须满足上述不变量并提供测试证据。

## 验证要求

实现阶段必须提供：

1. Secret 创建、读取、轮换、撤销、TTL 到期和 backend 不可用的 fail-closed 测试。
2. API Key 一次性展示、数据库/日志/SSE/错误/审计/导出脱敏和秘密扫描测试。
3. localhost、IPv4/IPv6 loopback、私网、link-local、云元数据、DNS rebinding、越界重定向、跨 host 凭据转发和非 HTTPS 测试。
4. TLS 主机名校验、超时、响应大小、重试预算和取消传播测试。
5. 连接测试成功/失败均不刷新目录、不启用模型、不创建 AI Task 的副作用测试。
6. macOS 钥匙串、Docker/KMS backend、受控 Provider fixture 和桌面/Web 双入口的运行证据。

当前没有产品源码、Secret backend、ProviderEgress、真实 Provider 或安全测试证据；本 ADR 只冻结设计基线。
