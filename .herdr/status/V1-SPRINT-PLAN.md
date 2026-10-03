# V1 快速完成冲刺计划

**基于**: V1-实现状态.md + Wave 1进展
**目标**: 3-4周内完成V1可演示版本
**策略**: Web优先 + 关键FR闭环 + 并行推进

---

## 📊 当前V1真实状态

### ✅ 已完成（本地验证）
- FR-010/011/012/013/014/015: 身份、Key、Provider账号、审计 ✅
- FR-002: 开发者中心与APP生命周期（基础实现）✅
- FR-003: Skill/MCP接入（基础实现）✅
- FR-009: 系统助手（基础实现）✅

### ⚠️ 部分完成
- FR-001: 桌面（基础证据，bridge未通）
- FR-005: AI任务（Provider通，持久化链待完成）
- FR-007: 模型配置（基础实现）

### ❌ 主要缺口
1. **完整演示链未打通**: Provider → Task → SSE → Artifact
2. **Native Workbench未显示内容**: Bridge handshake超时
3. **Web版未完整验证**: 缺E2E证据
4. **真实外部Provider**: 被安全策略阻塞（已解决90%）

---

## 🎯 V1 MVP定义（务实版）

### 核心目标
**能演示的完整链路**：
```
管理员登录 → 配置Provider → 选择模型 → 
提交Task → 看到SSE流式输出 → 查看结果
```

### 两个版本并行
1. **Web版（主线）**: Docker Compose本地部署，2周完成
2. **macOS版（副线）**: 桌面应用，持续优化

### 验收标准
- ✅ 有视频演示完整流程
- ✅ E2E测试通过
- ✅ 文档完整
- ⚠️ 不要求生产级部署
- ⚠️ 不要求全部15个FR完美

---

## 📅 4周冲刺计划

### Week 2 (2026-W41): 完整演示链

**目标**: Web版完整演示链打通

#### Wave 2-A: Provider到Task持久化（2-3天）
```yaml
WP-W2-01: 完成Provider持久化链
  Owner: Worker-AI
  当前: 已90%，只差环境变量和最后验证
  任务:
    - 设置 DGOS_PROVIDER_ALLOW_HOSTS=cc.nextcc.cc
    - 完成Task创建、SSE、Artifact持久化验证
    - 收集完整manifest证据
  预计: 今晚-明天（3-5小时）
  优先级: P0（阻塞主线）

WP-W2-02: Web完整UI演示
  Owner: Worker-Web
  依赖: WP-W2-01完成
  任务:
    - 集成真实Provider API
    - Task提交界面完整流程
    - SSE实时展示
    - 结果查看和重新查询
  预计: 2天
  优先级: P0

WP-W2-03: E2E测试覆盖
  Owner: Worker-Test
  并行: 可以和WP-W2-02并行
  任务:
    - 完整链路E2E测试
    - Provider配置到Task结果
    - 断线恢复测试
  预计: 2天
  优先级: P0
```

**里程碑**: Week 2结束时，Web版完整演示可用 ✅

---

### Week 3 (2026-W42): Native优化 + 其他FR补齐

#### Wave 2-B: Native Workbench修复（并行低优先级）
```yaml
WP-W2-04: 诊断Native bridge超时
  Owner: Worker-Native
  任务:
    - 深入分析为什么handshake超时
    - 检查API/catalog启动链缺失
    - 找出iframe加载阻塞原因
  预计: 3-5天
  优先级: P1（不阻塞主线）

WP-W2-05: 补充Native环境支持
  Owner: Worker-Platform
  依赖: WP-W2-04诊断结果
  任务:
    - 补充完整API/catalog环境
    - 修复bridge handshake
    - 验证Workbench内容显示
  预计: 3-5天
  优先级: P1
```

#### Wave 2-C: 其他FR补齐（并行）
```yaml
WP-W2-06: FR-003完整实现
  Owner: Worker-Platform
  任务:
    - Skill/MCP读取权限UI
    - 翻译/MCP/Run恢复
    - 完整授权流程
  预计: 3天
  优先级: P2

WP-W2-07: FR-009助手UI
  Owner: Worker-Web
  任务:
    - 系统助手界面
    - 快捷指令选择
    - 确认/取消流程
  预计: 2天
  优先级: P2

WP-W2-08: FR-002完整入口
  Owner: Worker-Web + Worker-Platform
  任务:
    - 应用目录浏览器/原生入口
    - 开发者中心UI完善
  预计: 3天
  优先级: P2
```

**里程碑**: Week 3结束时，多个FR基本完整 ✅

---

### Week 4 (2026-W43): 集成验证 + 文档

#### Wave 3: 集成验证
```yaml
WP-W3-01: 完整E2E测试套件
  Owner: Worker-Test + Verify
  任务:
    - 所有FR的E2E测试
    - Web版完整回归
    - Native版基础验证
  预计: 3天

WP-W3-02: 文档完善
  Owner: Worker-Platform + Planner
  任务:
    - 更新V1-实现状态.md
    - 补充证据manifest
    - 编写部署指南
  预计: 2天

WP-W3-03: 演示视频和报告
  Owner: Lead
  任务:
    - 录制完整演示视频
    - 编写V1完成报告
    - 列出已知限制
  预计: 2天
```

**里程碑**: Week 4结束时，V1 MVP完成 ✅

---

## 🚀 立即启动任务（今晚-明天）

### Phase 1: 打通Provider链（今晚，2-3小时）

**WP-W2-01**: Worker-AI完成Provider持久化
- 设置环境变量
- 完成Task/SSE/Artifact验证
- 收集证据

### Phase 2: Web演示UI（明天开始，2天）

**WP-W2-02**: Worker-Web完整UI
- 集成真实API
- 完整流程UI
- SSE展示

**WP-W2-03**: Worker-Test并行
- E2E测试

### Planner 紧急并行派发补充（2026-10-03）

以下工作包已生成到 `.herdr/work/`，其中 W2-03/04/06/07 可立即启动；W2-02 可立即做准备，但真实联调必须等待 W2-01 稳定契约。实现状态仍以 `docs/02-产品与版本/当前版本/V1-实现状态.md` 为唯一权威，不因工作包创建而升格。

| 包 | Owner | 优先级 | 当前动作 | 依赖 |
|---|---|---:|---|---|
| WP-W2-01 | worker-ai | P0 | 进行中 | — |
| WP-W2-02 | worker-web | P0 | 立即准备，随后联调 | W2-01 |
| WP-W2-03 | worker-test | P0 | 立即启动测试设计/夹具 | W2-01（真实执行） |
| WP-W2-04 | worker-native | P1 | 立即启动 | 独立 |
| WP-W2-06 | worker-platform | P1 | 立即启动 | 独立 |
| WP-W2-07 | worker-web | P1 | 立即启动 | 独立；避开 W2-02 共享布局冲突 |

Context-pack：`context-w2-02-web-ui.md`、`context-w2-03-e2e.md`、`context-w2-04-native.md`、`context-w2-06-fr003.md`、`context-w2-07-fr009-ui.md`。

Work-package：`wp-w2-02-web-full-demo.md`、`wp-w2-03-web-e2e.md`、`wp-w2-04-native-bridge-diagnosis.md`、`wp-w2-06-fr003-completion.md`、`wp-w2-07-fr009-assistant-ui.md`。

---

## 📊 并行度规划

### Week 2 (高并行)
- Worker-AI: WP-W2-01 (P0, 阻塞) → 完成后idle
- Worker-Web: WP-W2-02 (P0, 依赖W2-01)
- Worker-Test: WP-W2-03 (P0, 并行)
- Worker-Native: WP-W2-04 (P1, 后台诊断)
- **并行度**: 3-4个

### Week 3 (中并行)
- Worker-Native: WP-W2-04 → WP-W2-05
- Worker-Platform: WP-W2-06
- Worker-Web: WP-W2-07, WP-W2-08
- Worker-Test: 配合验证
- **并行度**: 3-4个

### Week 4 (收敛)
- Worker-Test + Verify: WP-W3-01
- Worker-Platform + Planner: WP-W3-02
- Lead: WP-W3-03
- **并行度**: 2-3个

---

## ✅ 成功指标

### Week 2 结束
- ✅ Web版完整演示可录视频
- ✅ Provider → Task → SSE → Artifact端到端work
- ✅ E2E测试覆盖主流程

### Week 3 结束
- ✅ FR-003/009/002基本完整
- ⏳ Native Workbench持续改进（可能仍未完全解决）

### Week 4 结束
- ✅ V1 MVP可交付
- ✅ 完整文档和演示
- ✅ 已知限制清晰列出

---

## ⚠️ 风险和应对

### 风险1: Native bridge问题复杂
**应对**: 
- Week 2专注Web版（不依赖Native）
- Native作为后台任务持续优化
- 最坏情况：V1只交付Web版

### 风险2: 真实Provider持续问题
**应对**:
- Worker-AI已解决90%
- 今晚/明天应该能完全解决
- 备选：使用Mock演示（但尽量用真实Provider）

### 风险3: 时间不够
**应对**:
- 优先级明确（P0 > P1 > P2）
- P2任务可以延后到Week 5
- MVP定义务实（不追求完美）

---

## 💡 关键决策

### 决策1: Web优先 ✅
- Web环境成熟，风险低
- 能快速展示完整功能
- Native作为增值，不阻塞主线

### 决策2: 不追求15个FR全部完美 ✅
- FR-001/005/007核心链必须work
- FR-002/003/009基础实现即可
- FR-010~015已完成（本地验证）
- FR-004/006/008本就不在V1范围

### 决策3: 务实的验收标准 ✅
- 有演示视频 > 生产级部署
- E2E测试通过 > 100%覆盖
- 文档完整 > 完美细节

---

## 🚀 立即行动

**现在（22:55）**:
1. 派发WP-W2-01给Worker-AI
2. 今晚/明天完成Provider链
3. 明天开始WP-W2-02和WP-W2-03

**4周后**:
- V1 MVP完成交付 ✅
- Web版完整可演示 ✅
- Native版持续优化 🔄

---

**准备就绪！要立即启动WP-W2-01吗？**
