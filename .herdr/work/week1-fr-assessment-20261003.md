# V1 第一周 Planner 评估与计划

**工作包**：DGOS-V1-MVP-20261003（Wave 1）  
**日期**：2026-10-03  
**角色**：Planner（OpenCode）  
**权威基线**：`docs/02-产品与版本/当前版本/V1-实现状态.md`（更新时间 2026-10-02）、V1 版本总览、V1 需求编号/追踪矩阵、各 FR 主规格与 `.herdr/delivery-board.yaml`。

## 1. 结论摘要

当前不能把任何 FR 判为“已完成”。状态表中 12 项 active FR 已有本地或基础实现，但统一候选仍受 native 双宿主、最终候选一致性、真实依赖和发布证据限制；FR-004/006/008 是后续版本规划，不应进入本周 V1 开发统计。

本周只推进两个最关键、且能形成可演示闭环的目标：

1. **P0：V1-FR-001 桌面与应用工作区**——解除 Wave 1 的“能启动并看到 Workbench”阻塞，优先完成 native/web 双宿主最小启动与稳定 handshake/frame-present 证据。
2. **P0：V1-FR-005 + V1-FR-007 联合演示切片**——Provider 配置/模型选择 → 文本 AI Task → SSE/终态/结果展示；FR-005 与 FR-007 在规格和实现状态中明确互相依赖，作为一个演示链拆成边界清楚的并行包，不扩张到媒体、画布或真实发布。

FR-003、FR-009、FR-012/013/015 已具备较多本地证据，但不是本周首要推进目标：它们可作为上述链路的依赖/回归范围，避免重新铺开已完成的局部实现。

## 2. 15 个 FR 的真实进度

| FR | 规格交付 | 实现状态真实判断 | 证据与主要缺口 | 优先级 |
|---|---|---|---|---|
| FR-001 | V1 active | **本地验证，演示阻塞** | 桌面/网络/UI 有 r6/r7 证据；native r13/r14 仍 handshake/frame/Workbench 链阻塞，最终 dist、双宿主、签名公证未验收 | P0 |
| FR-002 | V1 active | **本地验证** | 包 r11 覆盖签名、目录、安装/更新/回滚；完整浏览器/native 入口、跨进程恢复、正式信任根/发布门禁缺失 | P1 |
| FR-003 | V1 active | **基础实现** | PG/公开管理和 macOS sandbox 有局部证据；读取授权真实 UI 正反例、翻译/MCP/Run 恢复、最终镜像回归仍缺 | P1 |
| FR-004 | 后续版本 | **规划中（不计 V1）** | V2–V5 规划；不进入本周 | P3 |
| FR-005 | V1 active | **本地验证，闭环未锁定** | Provider/Workbench 有 r6/r9；最终 Web/macOS 签名链、断线/取消/未知提交恢复、外部 Provider 和完整终态矩阵缺 | P0 |
| FR-006 | 后续版本 | **规划中（不计 V1）** | V5 规划；不进入本周 | P3 |
| FR-007 | V1 active | **本地验证，关键依赖** | Profile/参数/快照/准入和 UI 有证据；目录分类默认/失败禁用/并发审计/UI 负例及真实外部 Provider 缺 | P0 |
| FR-008 | 后续版本 | **规划中（不计 V1）** | V4 规划；不进入本周 | P3 |
| FR-009 | V1 active | **基础实现** | Action resolver/权限/原子设置有证据；真实助手 UI 授权、导航确认拒绝取消、生命周期/Run 恢复双宿主链缺 | P1 |
| FR-010 | V1 active | **本地验证** | 双 API/PG/Redis、设备/renew/fresh gate、UI 有证据；最终迁移、两宿主会话、高风险再认证、部署 Secret 缺 | P1 |
| FR-011 | V1 active | **本地验证** | scope、跨实例、轮换/撤销/过期和脱敏有证据；一次性明文 UI/存储扫描、全入口主体、原子失败及目标部署缺 | P1 |
| FR-012 | V1 active | **本地验证** | 账号/Secret 引用/绑定/worker 准入和 UI 子集有证据；停用传播、CAS、删除保护/Secret 补偿、外部 Provider/目标 Secret 缺 | P1 |
| FR-013 | V1 active | **本地验证** | r17 修复 429/畸形 200/慢取消，独立矩阵 8/8；最终候选 fresh gate、完整 UI 诊断、CA/DNS/外部 Provider 缺 | P1 |
| FR-014 | V1 active | **本地验证** | 审计查询/outbox/CAS、清理/恢复、UI 策略审计有证据；高风险原子性、冲突 UI、目标环境保留/RPO/RTO 缺 | P1 |
| FR-015 | V1 active | **本地验证，需随 Task 回归** | reservation/settlement/release/reconciliation 和扩展结算有证据；全入口原子准入、全终态、可信 usage、性能 profile、历史漂移、发布证据缺 | P1 |

### 状态判定原则

- “本地验证”只表示受控本地依赖下已有证据，**不等于**外部依赖、最终候选或发布通过。
- “基础实现”表示主链已有代码，但关键 UI/授权/恢复或 AC 尚未闭环。
- FR-004/006/008 保留稳定编号，但按版本总览和追踪矩阵不计入 V1 首发门禁。
- 全量历史诊断曾有 280 tests、218 pass、9 fail、53 skipped；后续隔离回归 89 文件 267 pass 仅证明受控本地范围，不能升格为统一候选通过。

## 3. 第一周目标与验收口径

### Wave 1 目标（1 周）

**可演示最小闭环**：单机 macOS/本地 Web 环境启动 DGOS，看到 Workbench；完成一个受控 Provider 配置，选择可用文本模型，提交任务，看到 SSE 增量、同一 taskId 终态和结果。

### 本周不做

- 不推进画布、媒体、资产、市场、计费、组织协作。
- 不把 mock、fixture、静态检查或旧构建截图写成真实候选通过。
- 不在本周承诺 Developer ID、公证、生产 KMS、真实外部 Provider 或完整发布门禁；这些作为后续门禁包单独留证。

## 4. Work-package 规划

最大并行度遵循 delivery-board：3 个包；完成一个立即交 Verify，阻塞不超过 1 天。

### WP-W1-01：FR-001 Native/Workbench 启动闭环

- **Owner**：Worker-Native（必要时 Worker-Web 协同）
- **优先级**：P0
- **预计**：2–3 天
- **目标**：修复并证明 macOS native 宿主加载最终当前 dist，能从入口启动 Workbench，完成 iframe/bridge handshake 和 frame-present；Web 入口保持可复现。
- **允许路径**：`apps/desktop/`、`apps/ai-workbench-package/`、`apps/web/`（仅联调所需）、`apps/desktop/scripts/`、对应测试/证据路径。
- **依赖**：FR-002 安装包/应用入口现有能力；FR-010 Session；FR-003/权限仅使用现有契约。
- **验收**：
  - [ ] native 真实前台窗口由正确 PID/WindowServer owner 持有。
  - [ ] 当前候选 dist 可加载 Workbench，握手、frame-present、清理均有日期化 manifest。
  - [ ] Web 入口可启动并显示同一 Workbench 关键页面。
  - [ ] 失败时有稳定错误/超时和无副作用清理，不伪造成功。
  - [ ] 不改 V1-FR-001 的系统设置、权限和项目边界。

### WP-W1-02：FR-005/007 Provider → Task 核心链

- **Owner**：Worker-AI；Worker-Web 可并行做 UI 联调
- **优先级**：P0
- **预计**：2–3 天
- **目标**：在既有 r5/r6/r9 能力上收敛一个可复现 text-only 演示：Provider 配置/验证 → 模型目录/默认选择 → submit → SSE → terminal → artifact/result。
- **允许路径**：`src/provider/`、`src/provider-adapters/`、`src/ai-task/`、`apps/api/`、`apps/web/`、相关 `tests/provider/`、`tests/integration/`、`apps/web/e2e/`。
- **依赖**：FR-010 Session、FR-012 Provider account/Secret 引用、FR-013 probe、FR-015 quota；WP-W1-01 完成后做 native 联调，但可先在 Web/mock 入口开发。
- **验收**：
  - [ ] Provider 只通过 DGOS Secret/Adapter，不回显秘密或私有 endpoint。
  - [ ] 仅选择 active、可用、能力匹配的 text 模型；失败/过期模型不可提交。
  - [ ] 同 requestId 重复提交返回同一 taskId，不重复调用上游。
  - [ ] SSE 增量按序、断线后可用 cursor/query 恢复，最终状态不倒退。
  - [ ] succeeded/failed/cancelled/timed_out 至少覆盖演示所需终态；artifact/result 可读。
  - [ ] quota reservation/settlement/release 与 Task 终态不重复、不遗漏。

### WP-W1-03：统一候选回归与证据收敛

- **Owner**：Worker-Test/DevOps；Verify 独立执行
- **优先级**：P0
- **预计**：持续 3–5 天，随前两个包增量运行
- **目标**：建立单一候选运行方式，防止不同 dist、源码和数据库批次拼接成“完成”。
- **允许路径**：`tests/`、`scripts/`、`docs/05-测试与发布/端到端验收/报告/`、`.herdr/evidence/`。
- **依赖**：WP-W1-01/W1-02 每个可验证增量；不修改产品代码语义。
- **验收**：
  - [ ] 每批 manifest 含 code_version、asset_sha256、环境、命令、结果和限制。
  - [ ] 至少有 Web text-only 和 native Workbench 两个独立结果，明确不可互相替代的范围。
  - [ ] `check-docs`、类型检查、目标单测/集成测试实际执行并保留输出。
  - [ ] 失败批次保留，不能覆盖历史失败或升格局部证据。
  - [ ] Verify 给出 PASS/FAIL、阻塞项和下一步，不由 Planner 自行代验收。

## 5. 并行边界与依赖图

```text
WP-W1-01 Native/Workbench ─────┐
                               ├─> WP-W1-03 统一候选回归/Verify
WP-W1-02 Provider→Task ────────┘

WP-W1-02 内部：
  Provider/Adapter/API  ||  Web UI/mock
  真实联调与最终证据       -> 依赖 API + UI 汇合
```

- WP-W1-01 与 WP-W1-02 可并行；两者不得同时重写同一契约或迁移文件。
- WP-W1-02 的 Web UI 可以先 mock，但联调必须使用真实 DGOS API/Secret/Task 语义。
- WP-W1-03 不等待整周结束；每个包有可执行增量就交 Verify。
- 若 native 在 1 天内仍无法形成可诊断的 handshake 进展，Lead 应冻结 native 修复范围，先交付 Web text-only 演示，另立 native 阻塞包，不拖延 WP-W1-02。

## 6. 每日节奏

| 日程 | 重点 | Planner 输出 |
|---|---|---|
| 周一 | Lead 确认 P0 范围；Worker 读取 context/契约；建立运行命令 | context-pack、3 个 WP、依赖和冲突清单 |
| 周二 | Native 与 Provider/Task 并行；Web mock/UI 跟进 | 每包首个可验证增量；立即交 Verify |
| 周三 | Web/native 联调；修复首轮失败 | 增量证据 manifest、差距更新 |
| 周四 | 断线/取消/未知提交/权限负例；native 清理和重启 | 候选回归批次，保留失败证据 |
| 周五 | Verify 独立回归；Lead 决定是否进入 Wave 2 | 状态回写建议、残余阻塞、下周入口 |

## 7. 需要 Lead 确认的决策

1. **本周演示范围**：确认采用“macOS native 启动 + Web/Workbench text-only”双入口，外部 Provider/签名公证不作为本周完成条件。
2. **FR-001 阻塞处理**：若 native 首日不能取得 handshake/frame-present 的实质进展，是否按上述规则先交 Web 演示、native 单独阻塞。
3. **状态回写**：本周只在真实证据出现后更新 `V1-实现状态.md`；Planner 不将局部包通过写成 FR 已完成。

## 8. 依据文件

- `docs/02-产品与版本/当前版本/V1-实现状态.md`
- `docs/02-产品与版本/当前版本/V1-版本总览.md`
- `docs/03-功能规格/V1/00-V1需求编号.md`
- `docs/03-功能规格/V1/00-V1需求追踪矩阵.md`
- `docs/03-功能规格/V1/01-桌面与系统/01-桌面与应用工作区.md`
- `docs/03-功能规格/V1/05-AI工作流/01-多模态AI任务工作流.md`
- `docs/03-功能规格/V1/07-模型与配置/01-模型平台与工作流配置.md`
- `.herdr/delivery-board.yaml`
