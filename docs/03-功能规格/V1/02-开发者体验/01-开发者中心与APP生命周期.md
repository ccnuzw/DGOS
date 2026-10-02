---
title: "02 开发者中心与 APP 生命周期"
version: V1
feature_id: V1-FR-002
domain: 开发者体验
updated: 2026-09-30
delivery_scope: active
planning_only: false
delivery_slice: V1-platform
---
# 01 开发者中心与 APP 生命周期

> 范围说明：本功能进入 V1 首发时交付 DGOS 包校验、管理员最小审核准入、受信目录登记、普通用户安装/更新/卸载、开发者测试安装、健康检查和基本失败回滚；评分、收费和规模化投稿运营属于后续版本。

## 功能卡

| 项目 | 内容 |
| --- | --- |
| 领域 | 开发者体验 |
| 上游依赖 | DGOS manifest/API/SDK、应用安装服务、应用目录和发布校验服务 |
| 版本 | V1 |
| 规格负责人 | 产品负责人 |
| 规格状态 | Ready |
| 规格版本 | 1.0 |
| 更新时间 | 2026-09-30 |

## 目标

开发者能创建和校验 DGOS 应用包，在 DGOS 测试环境安装，查看权限和 API 兼容问题，并按渠道发布不可覆盖的 Release。

## 功能边界

包含：清单编辑、资源检查、权限提示、开发者测试安装、管理员审核后进入批准目录、普通用户从批准目录安装/更新/卸载、版本/build/releaseChannel 和发布记录。

不包含：市场评分、收费、账号体系和规模化投稿运营；V1 实现管理员批准目录所需的审核状态、来源/签名校验和本地包安装闭环。

## 来源与追踪

- 需求：`V1-FR-002`
- 来源：[DX OS 外部开发者中心研究摘要](../../../90-参考资料/DX-OS官网开发者中心摘要.md)、Ep1 07:30–12:30；该资料仅作为产品研究输入
- 设计输入：[DX-OS 开发者文档研究](../../../90-参考资料/DX-OS开发者文档研究.md)
- DGOS 契约基线：[V1 DGOS 应用清单与运行时契约](../../../04-技术架构/当前版本/V1-DGOS应用清单与运行时契约.md)
- 截图证据：[DX-OS成熟软件截图证据](../../../90-参考资料/DX-OS成熟软件截图证据.md) 第三轮第一批 Image 6
- 截图证据补充：[DX-OS成熟软件截图证据](../../../90-参考资料/DX-OS成熟软件截图证据.md) 第三轮第二批 Image 1、Image 2、Image 3、Image 6
- 关联 E2E：`V1-E2E-02`

## 完成定义

清单、权限、资源、版本和发布失败路径具备可执行验收；不允许以同 version/build 覆盖既有 Release。

## 需求说明

### 用户故事

作为开发者，我希望在发布前看到包和权限问题，以便安全地安装和迭代 APP。

### 业务规则

1. 应用包必须包含 DGOS manifest、声明的入口和存在的资源引用；不得要求 `dx-app.json` 作为 DGOS 契约。
2. stable/beta 发布必须递增 version 或 build；Release 发布后不可覆盖。
3. `dataVersion` 变化必须声明迁移，否则更新/回滚拒绝。
4. 获取/安装、打开、更新、卸载和删除应用数据是不同生命周期操作；卸载不得默认删除应用数据、项目数据或仍被引用的 Artifact。
5. 普通用户只能管理官方发布或管理员批准目录中的包；未审核开发者包仅能由有权限的开发者走测试安装。
6. manifest/目录策略必须标记预装应用是否可卸载；不可卸载的预装应用拒绝普通用户卸载并返回稳定原因。可卸载预装应用、官方目录包和审核上架开发者应用可由普通用户安装/更新/卸载。

### 前置依赖与执行边界

本功能依赖manifest/schema、真实包签名/来源校验、安装/健康检查、管理员审核和版本化安装记录。操作前建立主体、渠道、当前安装版本，校验appId/version/build/dataVersion及卸载策略。2026-10-02公共投影已登记OpenAPI与[V1应用契约](../../../04-技术架构/当前版本/V1-DGOS应用清单与运行时契约.md)引用的manifest schema；新字段唯一语义与旧数据一次迁移见[工程核查](../../../04-技术架构/当前版本/V1-应用与扩展工程契约核查.md)。登记不等于Worker产物已整合。

### 主流程

1. 创建或导入 APP 包。
2. 校验清单、资源和权限。
3. 开发者在测试环境安装并运行健康检查；管理员审核通过后生成批准目录条目。
4. 普通用户从批准目录安装、更新或卸载可卸载包；系统拒绝不可卸载预装包的卸载请求。
5. 填写 releaseNotes，生成目标渠道 Release。

### 异常与边界

- 清单缺失/权限不足或审核未通过：阻止进入批准目录并指出具体项；开发者仍可在权限允许时使用测试安装。
- 健康检查失败：恢复旧代码，保留应用数据、项目和设置。
- 版本冲突：拒绝发布，不覆盖现有 Release。

### 页面与交互

开发者中心包含 APP 列表、详情/配置、协议文档、安装和发布面板；校验结果必须能定位到文件或权限。

### 领域数据语义

包、Release、版本、build、渠道、签名和 dataVersion 归发布系统所有；APP 项目数据与安装包分离。

### 本版本不做

不实现市场搜索、评分、计费和跨账户发布权限管理。

## 接口契约

使用 DGOS 应用目录、安装、校验和发布 API；字段与生命周期以 [V1 DGOS 应用清单与运行时契约](../../../04-技术架构/当前版本/V1-DGOS应用清单与运行时契约.md) 为设计基线；不依赖 DX Developer 或 `window.dx.invoke`。

### 接口清单

包提交/验证使用submitAppManifest，目录查询listApps/getApp，管理员准入approveApp/rejectApp/withdrawApp，开发者测试testInstallApp，普通生命周期installApp/launchApp/updateApp/uninstallApp/checkAppHealth。所有写入重新授权并审计，字段以OpenAPI为准。

### OpenAPI operation 映射

| 业务能力 | operationId | 字段权威与限制 |
| --- | --- | --- |
| 包验证/提交 | `submitAppManifest` | 真实字节/签名验证，请求不授予来源或信任 |
| 目录读取 | `listApps`、`getApp` | 普通主体只见官方或批准目录 |
| 审核准入 | `approveApp`、`rejectApp`、`withdrawApp` | 准入不自动提升信任等级 |
| 测试安装 | `testInstallApp` | 独立开发者能力，不能变成公开批准 |
| 安装/启动/更新/卸载/健康 | `installApp`、`launchApp`、`updateApp`、`uninstallApp`、`checkAppHealth` | OpenAPI AppInstallRecord；真实执行/回滚证据独立验证 |

共享权限前置使用`checkPermission`，每次副作用仍重算来源、批准状态、主体与范围；前端隐藏按钮不能代替执行层校验。

### 本地生命周期动作约束

### 字段规则

请求、响应字段的类型/必填/枚举仅由OpenAPI的AppPackageEnvelope、AppReleaseMutation、AppMutation、AppPackageRecord、AppInstallRecord及manifest schema定义。渠道与版本共同定位不可覆盖发行，所有权来自认证上下文；来源、批准状态及有效信任不是调用者输入。字段非法、版本冲突或信任不足须在副作用前拒绝。

### 成功响应

提交成功返回已验证包摘要及平台计算的来源/准入信息；生命周期成功返回安装状态与数据保留结果；真实健康与回滚结果不能用状态模拟代替。完整响应形状引用OpenAPI，不在主文档复制schema。

### 生命周期操作治理

下列动作通过上述operation映射执行；HTTP/manifest字段只维护在机器契约。本表是语义不变量，不代表真实包或宿主已经验收。

| 动作 | 前置条件 | 成功终态 | 关键失败与无副作用 | 幂等/并发 | 重试/超时 | 观测/恢复 |
| --- | --- | --- | --- | --- | --- | --- |
| 包校验 | 包可读、manifest 存在、主体有开发者校验权限 | 返回校验结果和问题定位 | schema/资源/签名失败，不创建安装记录、不启动 APP | `packageDigest` 同一校验可重复；不写业务状态 | 纯本地校验 5s；不可重试的完整性错误立即返回 | requestId、校验日志摘要；修包后重新校验 |
| 测试安装 | 校验成功、开发者有测试安装权限、目标环境可用 | 安装记录进入 `installed` 或 `health_check_pending` | 失败不覆盖活动版本、不删除项目数据、不写入批准目录 | `appId + packageDigest + environment` 幂等；安装锁防并发 | 健康检查最多 1 次补偿重试，30s 超时；失败进入 rollback | requestId、健康检查、回滚审计；保留旧代码和数据 |
| 审核/目录准入 | 管理员主体、校验结果有效、审核状态可变更 | 审核记录和目录条目进入 `approved` | 拒绝不公开包、不创建普通用户可见目录条目 | `appId + packageDigest + reviewVersion` 幂等；审核记录乐观版本 | 外部签名检查 10s；失败不自动批准 | 审核事件和 reasonCode；待补材料后重新提交 |
| 发布 Release | version/build 高于已有 Release，dataVersion 迁移已声明 | 不可覆盖的 `published` Release | 冲突不覆盖旧 Release、不切换活动版本 | `appId + releaseChannel + version + build` 唯一 | 发布校验最多 2 次、15s；不得用新 build 绕过冲突 | releaseId、审计和指标；失败保留 candidate |
| 普通用户安装/更新/卸载 | 目录条目已批准，主体和包策略允许 | 安装状态可观察；更新后活动版本明确；卸载保留受保护数据 | 未审核/不可卸载/健康失败不改变活动版本、不删除项目或 Artifact | `appId + targetVersion + requestId` 幂等；同 appId 安装锁 | 连接/健康检查最多 1 次重试，30s；回滚旧代码 | requestId、安装状态和回滚记录；失败恢复旧版本 |

### 错误矩阵

| 场景 | error_key/结果 | 处理要求 |
| --- | --- | --- |
| manifest/资源无效 | `invalid_request` | 阻止安装并定位文件 |
| 签名/来源不可信 | `integrity_error` | 拒绝安装，不覆盖已安装版本 |
| 健康检查失败 | `rollback_required` | 回滚代码并保留项目数据 |

## 数据与事务

发布是不可覆盖的版本记录；安装失败必须原子回滚代码，不能删除项目数据。

### 涉及数据

应用包 manifest、资源索引、签名/来源、版本、build、releaseChannel、安装记录、健康检查结果和回滚记录。

### 约束与事务

校验结果必须在安装前完成；安装代码与健康检查、回滚记录原子更新；发布记录不可覆盖，安装失败不得删除项目数据。

### 字段读写矩阵

| 数据 | 开发者中心 | 安装服务 | 应用运行时 |
| --- | --- | --- | --- |
| manifest/资源 | 读写草稿 | 校验/读取 | 只读 |
| 版本与渠道 | 写入发布请求 | 固化记录 | 读取 |
| 安装/健康状态 | 读取 | 读写 | 读取自身状态 |

### 状态与生命周期

包：`draft` -> `validated` -> `installing` -> `installed`/`rollback`；Release：`candidate` -> `published`，发布后不可覆盖。

### 物理约束与迁移

应用发行字段以OpenAPI/manifest schema为准；D030语义不变。2026-10-02统一format、trustLevel及来源/批准分层，旧枚举仅一次迁移。dataVersion变化需迁移说明，安装回滚保留旧包；实际物理约束以增量migration为准，旧checksum不改。

### 数据所有权

发布服务拥有包、Release、签名和安装记录；应用拥有项目数据和用户设置；安装服务不得把两者合并存储。

### 安全与保留

签名校验、来源校验和权限声明按安全基线执行；发布审计保留版本与操作者摘要，不保存私钥；失败包按 D033 的 30 天逻辑期限清理临时副本。当前没有清理服务、migration 或执行证据。

## 验收标准

#### AC01 清单与资源校验

Given APP 包缺少 DGOS manifest 或引用了不存在的本地资源。

When 开发者执行校验或安装。

Then 系统拒绝继续并显示具体文件问题。

并且返回 `invalid_request` 和文件定位；不得创建安装记录、写入受信目录、启动包进程或修改当前活动版本，校验失败记录可通过 requestId 观察。

#### AC03 目录准入与普通用户生命周期

Given 一个官方包、一个管理员审核通过的开发者包、一个未审核开发者包，以及分别标记可卸载和不可卸载的预装应用。

When 普通用户从应用目录尝试安装、更新和卸载这些包，开发者尝试测试安装未审核包。

Then 官方包和批准包按策略完成安装/更新；可卸载包可被普通用户卸载；未审核包不进入普通用户目录但有权限的开发者可测试安装；不可卸载预装应用的卸载在副作用前被拒绝并保留活动版本、数据和审计。

可观察终态包括安装/审核记录、当前活动 version/build、目录可见性和拒绝审计；被拒绝的安装/卸载不得创建新的活动安装记录、删除应用数据或改变旧版本。

#### AC02 版本发布与回滚

Given 已有 stable Release，新的包 version/build 未递增或健康检查失败。

When 开发者发布或安装该包。

Then 发布被拒绝，或安装回滚到旧代码且项目数据保留。

并且可观察到 `version_conflict` 或 `rollback_required`、旧活动版本和回滚记录；失败不得覆盖已有 Release、删除项目数据或留下新的成功安装状态。

### 自动化测试映射

| AC 范围 | 自动化重点 | 建议测试文件 | 建议命令 | 当前状态 |
| --- | --- | --- | --- | --- |
| AC01–AC03 | 包校验、审核目录、生命周期、不可覆盖发布与回滚 | `tests/unit/runtime.test.mjs`、`tests/integration/runtime-api.test.mjs` | node --test tests/unit/runtime.test.mjs tests/integration/runtime-api.test.mjs | 已有状态/API子集；真实包及完整AC待验 |

### AC 逐项测试设计

| AC | 验收重点 | 测试层级 | 目标资产 | 目标命令 | 初始资产状态 |
| --- | --- | --- | --- | --- | --- |
| AC01 | 文件/权限错误 | Unit/公开HTTP | `tests/unit/app-packages.test.mjs`、`tests/integration/app-package-routes.test.mjs`、`scripts/v1-package-http.mjs` | env -u DGOS_DATABASE_URL node --test tests/unit/app-packages.test.mjs tests/integration/app-package-routes.test.mjs；node scripts/v1-package-http.mjs | G r11 16/16与公开12阶段；签名fixture非生产根 |
| AC02 | release原子性 | PG/公开HTTP | `tests/integration/postgres-app-packages.test.mjs`、`scripts/v1-package-http.mjs` | DGOS_DATABASE_URL="$DGOS_PACKAGE_TEST_URL" node --test --test-concurrency=1 tests/integration/postgres-app-packages.test.mjs；node scripts/v1-package-http.mjs | G r11 PG3/3；公开并发锁/不健康回滚通过，跨进程锁压力与目标宿主发布待验；旧release-rollback skip不作证据 |
| AC03 | 审核准入、生命周期和预装保护 | HTTP/签名包浏览器 | `scripts/v1-package-http.mjs`、`tests/integration/app-package-browser.test.mjs`、`apps/web/e2e/real-workbench.spec.mjs` | node scripts/v1-package-http.mjs；env -u DGOS_DATABASE_URL node --test tests/integration/app-package-browser.test.mjs | G r11/A r9本地子集；D当前签名包真实浏览器流程在途 |

### 回归要求

- 更新不得清空项目目录、用户设置或 MCP 配置。
- 发布渠道与清单 `releaseChannel` 一致。

## 实现与验证

2026-10-02 / r7回写：G r11已交主目录签名包生命周期、严格输入与服务端锁边界；`node scripts/v1-package-http.mjs`在15161、随机PG子库及临时签名根下12阶段通过，含非法override无副作用、并发更新、健康失败回滚、Task/Artifact保留和context桥。该批sourceBefore/After同为0aac82c22930007e07ddb563c18c7f40617060fbfadd1ebc07643dfdc4138590；unit/route 16/16、PG3/3属于另两条命令。报告与配对manifest见[本轮证据索引](../V1-AC资产核对-2026-10-02.md#r7-证据回写2026-10-02)。

A r9签名工作台1.0.1/build2在opaque Chromium桥fixture 1/1，包digest为sha256:0440088ded07140699950453704a5328b4a48e7046564216b6408d3d8a852eef；Lead integration r9记录该包实际升级和九项授权。真实包执行/签名验证不再是“无资产”，但临时签名根、单API并发锁测试、受控浏览器fixture均不证明生产信任链或完整双宿主发布；D当前浏览器验收和B Linux运行拓扑在途。脚本须按G报告独占15161及自建子库，不能指向共享业务库。

## 技术设计

见[开发者中心与 APP 生命周期技术设计](02-开发者中心与APP生命周期-技术设计.md)。
