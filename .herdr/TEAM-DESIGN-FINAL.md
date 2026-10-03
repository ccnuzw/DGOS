# DGOS Agent团队架构 - 基于真实项目需求

**设计依据**: 
- `docs/01-项目概览/Agent团队与SDD协作规范.md`
- `docs/04-技术架构/服务与领域边界.md`
- DGOS实际技术栈和并行需求

---

## 一、项目真实情况分析

### 1.1 DGOS技术架构

**物理进程**：
- `dgos-shell` (Tauri桌面)
- `dgos-api` (Fastify API)
- `dgos-worker` (后台任务)
- `dgos-extension-runner` (Skill/MCP隔离)
- `dgos-storage` (PG/Redis/MinIO)

**前端应用**：
- `apps/web` (React/TypeScript/Vite)
- `apps/desktop` (Tauri封装web)
- `apps/ai-workbench-package` (业务APP)

**逻辑领域** (src/):
- Identity & Session
- Permission & Policy
- App Catalog & Install
- Model & Provider
- AI Task
- Audit & Quota
- Extensions (Skill/MCP/Agent)
- System & Actions

### 1.2 V1的15个FR并行需求

**可并行的FR组**：
1. **身份治理组**: FR-010/011/012/013/014/015 (6个FR，高度独立)
2. **平台核心组**: FR-001/002/003 (系统基础)
3. **AI工作流组**: FR-005/007 (任务和配置)
4. **系统助手**: FR-009 (Action Registry)

**依赖链路**：
```
FR-001 → FR-002/003 → FR-007 → FR-005
FR-010 → FR-011/012/013 → FR-014/015
```

### 1.3 真实并行需求

从架构看，可以同时推进：
- **Backend领域1**: Identity/Session/Permission (Worker-A)
- **Backend领域2**: Provider/Model/AI Task (Worker-B)
- **Backend领域3**: Extensions/Actions/Apps (Worker-C可选)
- **Frontend**: Web UI全栈 (独立Worker)
- **Native**: Tauri/Desktop集成 (独立Worker)
- **DevOps**: 构建/打包/部署 (独立Worker)

**关键点**：这不是5个Worker够不够的问题，而是**领域边界清晰**，可以**真正并行**！

---

## 二、最优团队设计：6+1模式

### 2.1 团队结构

```
Lead (Claude/OpenCode)
    ↓
Planner (OpenCode + spec-docs)
    ↓
    ├─ Worker-Platform (Codex) - Identity/Permission/Apps/System
    ├─ Worker-AI (Codex) - Provider/Model/AI Task/Extensions
    ├─ Worker-Web (Codex) - React UI/Web前端全栈
    ├─ Worker-Native (Codex) - Tauri/Desktop/构建打包
    ├─ Worker-Test (Codex) - 测试/质量/证据（新增）
    └─ Worker-DevOps (Codex) - 部署/运维/集成（可选）
    ↓
Verify (Codex)
```

**核心改进**：
1. **保留原有合理结构**：Lead + Planner + Workers + Verify
2. **Worker按真实领域划分**：不是A/B/C/D/E标签，而是Platform/AI/Web/Native
3. **新增Worker-Test**：专门负责测试编写和质量保障
4. **保留Worker-DevOps**：构建/部署不是附属，是独立领域

### 2.2 为什么是6个Worker + 1个Verify

**并行度分析**：

| 场景 | 并行任务 | Worker分配 |
|------|---------|-----------|
| **高峰** | 5-6个任务 | Platform + AI + Web + Native + Test + DevOps |
| **常规** | 3-4个任务 | Platform + AI + Web + Test |
| **最小** | 2个任务 | 任意2个Worker |

**对比**：
- 3个Worker：并行度2-3，**无法充分利用领域独立性** ❌
- 5个Worker（我之前的方案）：勉强够用，但Test混在QA里 ⚠️
- **6个Worker**：充分并行，每个Worker专注自己的领域 ✅
- 8个Worker：过多，协调成本高 ❌

---

## 三、详细角色定义

### 3.1 Lead

**职责**：
- 战略协调，不是事无巨细
- 每周定义目标（1-2个FR）
- 分配工作包给Worker
- 解决跨Worker冲突
- 每天检查1次（晚上）

**关键原则**：
- **不过度介入**：Worker有明确边界，自主工作
- **快速决策**：技术选择2小时内，业务决策找用户
- **优先整合**：80%可用就合并，不追求完美

### 3.2 Planner

**职责**（基于spec-docs）：
- 读取docs/权威规格
- 使用spec-docs生成context-pack（不是流程文档，是上下文摘要）
- 拆解FR为work-package
- 定义并行边界和依赖
- 维护V1-实现状态.md

**产出**：
- Context-pack（docs/规格摘要，供Worker快速理解）
- Work-package（任务边界、验收标准、allowed_paths）
- 接口契约（OpenAPI片段，Backend/Frontend共同遵守）

**不是垃圾流程文档**：
- Context-pack是"从3000行docs提炼出的200行关键信息"
- 目的是让Worker不用读全部docs就能开工
- 这是有价值的

### 3.3 Worker-Platform (后端-平台)

**领域**：
- Identity & Session (FR-010)
- Permission & Policy
- App Catalog & Install (FR-002)
- System & Audit (FR-014)

**技术栈**：
- Node.js/Fastify API
- PostgreSQL schema和migration
- src/identity, src/permissions, src/apps, src/system

**独立性**：
- 数据库表独立：identity_*, permissions_*, apps_*, audit_*
- API路由独立：/api/v1/identity/*, /api/v1/apps/*
- 可以并行Worker-AI工作

### 3.4 Worker-AI (后端-AI)

**领域**：
- Provider & Model (FR-012/013)
- AI Task (FR-005)
- Extensions (FR-003)
- Actions (FR-009)

**技术栈**：
- Node.js/Fastify API
- PostgreSQL schema和migration
- Worker任务
- src/provider, src/ai-task, src/extensions, src/actions

**独立性**：
- 数据库表独立：providers_*, tasks_*, extensions_*
- API路由独立：/api/v1/providers/*, /api/v1/tasks/*
- 可以并行Worker-Platform工作

### 3.5 Worker-Web (前端)

**领域**：
- React UI全栈
- 页面和组件
- 状态管理
- API集成

**技术栈**：
- React/TypeScript/Vite
- apps/web/src
- packages/dgos-ui

**独立性**：
- 前端代码完全独立
- 通过OpenAPI契约对接Backend
- Mock数据先开发，Backend就绪后联调

### 3.6 Worker-Native (原生/桌面)

**领域**：
- Tauri集成
- macOS特性
- 桌面构建和打包
- apps/desktop

**技术栈**：
- Tauri 2/Rust
- apps/desktop

**独立性**：
- 依赖Web的dist，但可以先用旧dist开发
- 专注Native层逻辑

### 3.7 Worker-Test (新增-测试)

**职责**：
- 编写单元测试
- 编写集成测试
- E2E测试脚本
- 测试数据fixture

**为什么独立**：
- 测试是工程资产，不是"验证完就扔"
- 需要理解代码和规格
- 可以和实现并行（TDD）
- Verify只负责"运行"测试，Worker-Test负责"编写"测试

**技术栈**：
- tests/ 目录
- Vitest/测试框架
- fixture和mock数据

### 3.8 Worker-DevOps (运维/部署)

**领域**：
- Docker/Compose配置
- 构建脚本
- CI/CD
- 部署验证
- scripts/

**为什么保留**：
- 构建打包不是"附带工作"
- DGOS有多个发布形态：macOS包、Docker镜像、Compose配置
- 需要专门维护

### 3.9 Verify

**职责**（独立验证）：
- 运行Worker-Test编写的测试
- 检查工作包边界
- 收集证据
- 独立判断PASS/FAIL
- 4小时内反馈

**不做**：
- 不编写测试（Worker-Test做）
- 不修改代码

---

## 四、并行工作模式

### 4.1 典型Week的并行任务

**周一**：Lead + Planner定义本周目标
```
目标: 完成FR-012 Provider账号管理

Planner拆解:
├─ WP-01: Provider账号API (Worker-Platform)
├─ WP-02: Provider适配器 (Worker-AI)
├─ WP-03: Provider配置UI (Worker-Web)
├─ WP-04: Provider单元测试 (Worker-Test)
└─ WP-05: Docker环境配置 (Worker-DevOps)
```

**周二-周四**：并行执行
```
并行度=5

Worker-Platform: 实现Provider账号CRUD API
Worker-AI: 实现OpenAI/Anthropic适配器
Worker-Web: 实现Provider配置界面
Worker-Test: 编写Provider API和UI测试
Worker-DevOps: 配置测试环境

每个Worker完成 → Verify验证(4小时内) → PASS/FAIL
```

**周五**：整合
```
Verify: 运行完整测试套件
Lead: 验收，更新V1-实现状态.md
```

### 4.2 依赖处理

**串行依赖**（必须等待）：
```
WP-01 (API) 必须先完成 → WP-03 (UI)才能联调

解决: 
- WP-03先用Mock开发
- WP-01完成后Verify通过
- WP-03再联调真实API
```

**并行独立**（无需等待）：
```
WP-01 (Platform API)  ║  WP-02 (AI适配器)
完全独立，同时进行    ║  完全独立，同时进行
```

---

## 五、文档策略

### 5.1 权威文档（docs/）

**唯一真相**：
- 功能规格
- 接口契约(OpenAPI)
- 数据模型
- 架构设计
- 实现状态

**Worker只读**，变更通过Planner。

### 5.2 工作文档（.herdr/）

**极简原则**：
```
.herdr/
├── status/
│   └── current.yaml          # 当前状态(100行)
├── work/
│   ├── context-FR012.md      # Context-pack(有用！)
│   └── wp-001.md             # Work-package
├── evidence/
│   ├── test-reports/
│   └── screenshots/
└── roles/
    ├── lead.md
    ├── planner.md
    ├── worker-platform.md
    ├── worker-ai.md
    ├── worker-web.md
    ├── worker-native.md
    ├── worker-test.md
    ├── worker-devops.md
    └── verify.md
```

**每周清理work/**：完成的work-package归档。

---

## 六、与之前方案对比

| 方案 | 角色数 | 并行度 | 领域划分 | 测试 | 适合DGOS |
|------|--------|--------|---------|------|----------|
| 旧团队(历史) | 8个 | 混乱 | 不清晰 | Verify事后 | ❌ |
| v2极简 | 3个 | 2-3 | 太粗 | 混在QA | ❌ |
| v3平衡 | 5个 | 3-4 | Backend/Frontend | 混在QA | ⚠️ |
| **v4真实** | **7个(6Worker+Verify)** | **5-6** | **按DGOS领域** | **独立Worker-Test** | **✅** |

---

## 七、立即行动

### 清理strategy（已完成）
- ✅ 备份历史文件
- ✅ 删除垃圾文档

### 重建团队（现在执行）

1. **更新team.json**
```json
{
  "roles": [
    "lead",
    "planner",
    "worker-platform",
    "worker-ai",
    "worker-web",
    "worker-native",
    "worker-test",
    "worker-devops",
    "verify"
  ]
}
```

2. **创建9个角色文件**

3. **定义第一周目标**
   - 基于V1-实现状态.md
   - 选择1-2个优先FR
   - Planner拆解work-package
   - 派发给对应Worker

---

## 八、成功指标

### 第一周
- 5-6个work-package并行执行
- 每个Worker交付2-3个包
- Verify验证10+次
- 80%的包在4小时内通过验证

### 第一个月
- 完成6-8个FR
- V1-实现状态.md显著进展
- 团队协作流畅
- 文档保持精简

---

**这才是真正适合DGOS的高效团队架构！**
