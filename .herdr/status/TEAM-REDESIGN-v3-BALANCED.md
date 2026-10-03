# DGOS 高效Agent团队设计方案 v3.0 - 平衡版

**设计者**: Lead  
**日期**: 2026-10-03  
**原则**: 高效 + 稳定 + 合理分工 + 最小化垃圾文档

---

## 一、设计理念

### 1.1 目标

**既要高效，又要稳定**：
- ✅ 足够的并行度（可以同时推进多个FR）
- ✅ 明确的分工（避免职责不清）
- ✅ 快速的反馈（不要流程僵化）
- ✅ 稳定的质量（有检查和验证）
- ✅ 清晰的记录（但不是文档爆炸）

### 1.2 分析V1工作负载

从`docs/`看到V1有**15个FR**，分为几个领域：

```yaml
核心链路 (必须串行):
  FR-001: 桌面与应用工作区
  FR-002/003: 开发者中心、Skill/MCP接入
  FR-007: 模型平台配置
  FR-005: AI任务工作流

身份与治理 (可并行):
  FR-010: 管理员登录与会话
  FR-011/012/013: Key/Provider/连接测试
  FR-014: 审计治理
  FR-015: 用量额度

系统助手:
  FR-009: 系统助手与快捷指令

后续版本:
  FR-004/006/008: V2-V5功能
```

**工作负载评估**：
- 核心链路涉及：后端API、前端UI、Native、构建打包
- 身份治理涉及：数据库、安全、API
- 需要并行推进至少2-3个FR才能在合理时间内完成V1

---

## 二、团队结构设计

### 2.1 团队规模：5个角色

```
用户 (你)
    ↓
Lead (我) - 全局协调
    ↓
    ├─ Architect (1人) - 规划与架构
    ├─ Backend (1人) - 后端与数据
    ├─ Frontend (1人) - UI与交互
    └─ QA (1人) - 测试与质量
```

**为什么是5个？**

对比分析：
- 3个太少 → 无法并行2-3个FR，进度慢
- 8个太多 → 协调成本高，文档爆炸
- 5个刚好 → 可以2-3个并行任务，职责清晰

### 2.2 角色定义

#### Lead (我) - 战略协调者

```yaml
核心职责:
  - 制定每周目标和优先级
  - 分配任务给团队
  - 解决阻塞和冲突
  - 做关键技术决策
  - 每天检查进度

工作节奏:
  每周一:
    - 与Architect确定本周目标（1-2个FR）
    - 拆分为3-4个任务
    - 分配给Backend/Frontend
  
  每天:
    - 晚上检查进度（20分钟）
    - 如果阻塞，当晚或次日上午解决
  
  每周五:
    - 验收本周成果
    - 向用户汇报
    - 规划下周

产出:
  - 周计划（1页，列出目标和任务）
  - 日志（每天3-5行）
  - 周报（1页，成果和问题）
```

#### Architect - 技术规划者

```yaml
核心职责:
  - 理解docs/权威规格
  - 拆解FR为可执行任务
  - 定义接口和数据契约
  - 审查关键技术决策
  - 维护实现状态

为什么需要Architect:
  ❌ 不是为了写context-pack（那是垃圾）
  ✅ 而是确保：
    - Backend和Frontend理解需求一致
    - 接口契约提前定义
    - 不会出现"后端做完了前端才发现接口不对"
    - 架构决策有人把关

工作方式:
  每周一:
    1. 读取docs/对应FR规格
    2. 拆解为任务：
       - Backend任务: API + 数据库 + Worker
       - Frontend任务: UI + 交互
       - 接口契约: 双方都要遵守的API定义
    3. 写任务单（1页A4纸，不是长篇）
    4. Review Backend/Frontend的设计
  
  工作中:
    - 回答Backend/Frontend的技术问题
    - Review关键PR
    - 发现架构问题报告Lead
  
产出:
  - 任务单（1页/任务，清晰的输入输出）
  - 接口契约（OpenAPI片段）
  - 架构决策记录（有必要时）
  
不做:
  - 不写长篇context-pack
  - 不做重复文档
  - 不过度设计
```

#### Backend - 后端实现者

```yaml
核心职责:
  - 实现API、Worker、数据库
  - 写单元测试和集成测试
  - 配合Frontend联调

擅长领域:
  - Node.js/Fastify API
  - PostgreSQL/Redis
  - Worker进程
  - Provider适配

工作方式:
  接到任务:
    1. 读任务单（Architect提供）
    2. 读docs/相关规格
    3. 实现 + 测试
    4. 提交PR
    5. 配合Frontend联调
  
  遇到问题:
    - 技术问题: 先尝试2小时 → 问Architect
    - 需求不清: 问Architect
    - 架构冲突: 报告Lead
  
产出:
  - 代码 + 测试
  - API文档更新（如果接口变了）
  - 简短说明（5-10行commit message）
```

#### Frontend - 前端实现者

```yaml
核心职责:
  - 实现UI、交互、状态管理
  - 前端测试
  - Tauri集成和构建

擅长领域:
  - React/TypeScript
  - Tauri桌面应用
  - 前端测试
  - 构建和打包

工作方式:
  接到任务:
    1. 读任务单和接口契约
    2. 实现UI + 交互
    3. Mock数据先做起来
    4. 联调Backend API
    5. 提交PR
  
  遇到问题:
    - UI/UX不确定: 问Architect或Lead
    - 接口不对: 先找Backend，解决不了找Architect
    - 构建问题: 自己解决，解决不了报Lead
  
产出:
  - UI代码 + 前端测试
  - 截图（重要界面）
  - 构建产物（如果是构建任务）
```

#### QA - 质量保证者

```yaml
核心职责:
  - 验证Backend和Frontend的工作
  - 运行测试和检查
  - 集成测试和E2E
  - 收集证据

为什么需要独立QA:
  ✅ Backend/Frontend自己测不能替代独立验证
  ✅ 有人专门负责"整体是否work"
  ✅ 避免"开发说通过，实际一堆bug"

工作方式:
  Backend/Frontend提交后:
    1. 拉取代码
    2. 运行构建和测试
    3. 手动验证核心功能
    4. 4小时内给结论
  
  验证标准:
    ✅ PASS:
      - 构建成功
      - 测试通过（不要求100%）
      - 核心功能可用
      - 没有明显退化
    
    ❌ FAIL:
      - 构建失败
      - 核心功能broken
      - 严重bug
  
  每周:
    - 运行完整测试套件
    - 更新V1-实现状态.md
    - 收集证据（截图、测试报告）
  
产出:
  - 验证报告（简洁，3-5行或✅/❌）
  - 测试输出（日志、截图）
  - 周总结（更新实现状态）
```

---

## 三、工作流程

### 3.1 周循环（标准节奏）

```
周日晚上 (Lead):
  - 读取V1-实现状态.md
  - 思考下周优先级

周一上午 (Lead + Architect):
  - Lead定义本周目标（1-2个FR）
  - Architect拆解为3-4个任务
  - 分配: Backend 2个任务, Frontend 2个任务

周一下午 (Backend + Frontend):
  - 接任务，开始工作
  - Architect待命回答问题

周二-周四 (Backend + Frontend + QA):
  - Backend/Frontend独立工作
  - 完成后提交给QA
  - QA验证 → PASS/FAIL
  - FAIL → 当天或次日修复

周五上午 (QA):
  - 运行完整测试
  - 更新V1-实现状态.md
  - 准备周报

周五下午 (Lead):
  - 验收成果
  - 向用户汇报
  - 规划下周
```

### 3.2 任务流转

```
Lead定义目标
    ↓
Architect拆解任务 + 定义接口
    ↓
    ┌─────────────┴─────────────┐
    ↓                           ↓
Backend工作              Frontend工作
    ↓                           ↓
Backend提交              Frontend提交
    ↓                           ↓
    └─────────────┬─────────────┘
                  ↓
            QA验证 (4小时内)
        ┌─────────┴─────────┐
        ↓                   ↓
    ✅ PASS            ❌ FAIL
        ↓                   ↓
    合并main        返回修复 (1天内)
```

### 3.3 并行度控制

```yaml
正常状态:
  - Backend: 1-2个任务并行
  - Frontend: 1-2个任务并行
  - 总共: 2-4个任务在进行

高峰状态:
  - Backend: 2个任务
  - Frontend: 2个任务
  - 总共: 4个任务

阻塞处理:
  - 如果Backend阻塞，Frontend继续
  - 如果Frontend阻塞，Backend继续
  - Lead每天检查，1天内解决阻塞
```

---

## 四、文档策略

### 4.1 文档分类

```yaml
权威文档 (docs/):
  位置: docs/
  内容: 功能规格、架构设计、接口契约
  维护: 只在功能变更时更新
  权威: 这是唯一真相
  
工作文档 (.herdr/):
  位置: .herdr/work/
  内容: 任务单、接口契约草稿
  维护: 每周清理，完成的归档
  权威: 临时文档，完成后可删
  
状态记录 (.herdr/):
  位置: .herdr/status/
  内容: 当前任务、团队状态
  维护: 实时更新
  权威: 当前状态的唯一来源
  
证据 (.herdr/evidence/):
  位置: .herdr/evidence/
  内容: 截图、测试报告、运行日志
  维护: 累积，定期压缩归档
  权威: 证明"做了什么"
```

### 4.2 极简文档结构

```
.herdr/
  README.md              # 团队说明
  team.json              # 角色配置
  
  status/
    current.yaml         # 当前状态（实时更新）
    weekly-2026-W40.md   # 本周计划和进度
  
  work/                  # 工作文档（每周清理）
    task-001.md          # 任务单（1页）
    task-002.md
    api-contract-fr005.yaml  # 临时接口契约
  
  evidence/              # 证据
    screenshots/
    test-reports/
    logs/
  
  archive/               # 归档（移出项目外）
    2026-W39/            # 上周的工作文档
  
  roles/
    lead.md
    architect.md
    backend.md
    frontend.md
    qa.md
```

### 4.3 任务单模板

```markdown
# Task-001: 实现Provider账号管理API

**FR**: V1-FR-012  
**Owner**: Backend  
**Estimated**: 2天  
**Due**: 2026-10-05  

## 目标
实现Provider账号的创建、查询、更新、删除API

## 接口契约
POST /api/v1/providers/accounts
GET /api/v1/providers/accounts/:id
PUT /api/v1/providers/accounts/:id
DELETE /api/v1/providers/accounts/:id

详细: 见 work/api-contract-fr012.yaml

## 数据模型
表: provider_accounts
字段: id, name, provider_id, config, created_at, updated_at

Migration: 新建 0048-provider-accounts.sql

## 验收标准
- [ ] API实现并通过单元测试
- [ ] Migration可以运行
- [ ] Postman能调通CRUD
- [ ] 错误处理完整

## 依赖
- 需要Architect先定义详细接口契约
- 不依赖其他任务

## 风险
- Provider配置可能需要加密存储（待Architect确认）
```

---

## 五、清理.herdr/垃圾

### 5.1 清理策略

```yaml
立即删除（垃圾）:
  ❌ 所有*-CONTEXT-PACK.md
  ❌ 所有GAP-*-REPORT-*.md
  ❌ 所有MACOS-*-*.md（这些应该在docs/或代码注释）
  ❌ 所有ICON-*.md
  ❌ 所有*-SUMMARY.md
  ❌ DAY1-*, LEAD-PROGRESS-*.md
  ❌ DELIVERABLES.md, MIGRATION-GUIDE.md
  
保留（有用）:
  ✅ deployment.md (部署说明)
  ✅ V1-*-r*.md (如果是最新的证据)
  
移到archive（历史参考）:
  📦 archive/目录全部移到项目外备份
  
重新组织:
  - 剩下的有用文件按新结构整理
```

### 5.2 清理脚本

```bash
#!/bin/bash
# clean-herdr.sh

cd .herdr

# 1. 备份到项目外
tar -czf ~/DGOS-herdr-backup-20261003.tar.gz .
echo "✅ 已备份到 ~/DGOS-herdr-backup-20261003.tar.gz"

# 2. 创建新结构
mkdir -p status work evidence/{screenshots,test-reports,logs} roles

# 3. 保留deployment.md
mv deployment.md status/

# 4. 保留最新的V1证据（筛选最新的）
# (手动筛选，不能全删)

# 5. 删除垃圾
rm -f *-CONTEXT-PACK.md
rm -f GAP-*-REPORT-*.md
rm -f MACOS-*.md
rm -f ICON-*.md
rm -f *-SUMMARY.md
rm -f DAY*.md LEAD-PROGRESS-*.md
rm -f DELIVERABLES.md MIGRATION-GUIDE.md BACKUP-*.md
rm -f DATA-MANAGEMENT-*.md

# 6. 删除旧archive（已备份）
rm -rf archive

echo "✅ 清理完成"
echo "剩余文件:"
find . -name "*.md" | wc -l
```

---

## 六、实施计划

### 6.1 第一步：清理（今天，2小时）

```
1. 运行备份脚本
2. 执行清理
3. 创建新结构
4. 筛选保留的证据文件
5. 验证清理结果

目标: .herdr/从426个文件减少到<30个
```

### 6.2 第二步：重组团队（今天，2小时）

```
1. 重写5个角色文件
   - lead.md
   - architect.md
   - backend.md
   - frontend.md
   - qa.md

2. 更新team.json
   {
     "roles": [
       {"name": "lead", "kind": "claude"},
       {"name": "architect", "kind": "opencode"},
       {"name": "backend", "kind": "codex"},
       {"name": "frontend", "kind": "codex"},
       {"name": "qa", "kind": "codex"}
     ]
   }

3. 创建status/current.yaml

4. 停止旧Planner和所有Worker
```

### 6.3 第三步：启动第一周（明天开始）

```
周一上午:
  - Lead + Architect定义本周目标
  - Architect拆解任务
  - 派发给Backend和Frontend

周一下午:
  - Backend和Frontend开始工作

目标: 周五看到1-2个FR的明显进展
```

---

## 七、对比总结

### 7.1 团队规模对比

| 方案 | 角色数 | 优点 | 缺点 | 适用场景 |
|------|--------|------|------|----------|
| 旧团队 | 8个 | 分工细 | 协调成本高，文档爆炸 | ❌ 不适合 |
| v2极简 | 3个 | 极简 | 并行度低，进度慢 | 小项目 |
| **v3平衡** | **5个** | **平衡** | **需要好的流程** | ✅ DGOS V1 |

### 7.2 核心改进

```yaml
相比旧团队:
  ✅ 8个→5个: 减少协调成本
  ✅ 取消Planner的垃圾流程: 不再生成context-pack
  ✅ Architect专注技术: 不写流程文档，而是技术决策
  ✅ Backend/Frontend明确分工: 不再5个Worker混乱
  ✅ 独立QA: 质量有保障

相比v2极简:
  ✅ 5个→3个: 提高并行度
  ✅ 有Architect: 技术决策有人把关
  ✅ 稳定性更高: 不会因为2个Builder忙不过来
```

### 7.3 文档策略对比

```yaml
旧团队: 426个MD文件
v3平衡: <30个文件

减少的垃圾:
  - 不再有CONTEXT-PACK
  - 不再有长篇REPORT
  - 不再有重复的SUMMARY
  - 工作文档每周清理

保留的有用内容:
  + 任务单（但极简，1页）
  + 状态记录（实时）
  + 证据（截图、测试报告）
```

---

## 八、成功指标

### 8.1 效率指标

```yaml
第一周:
  - 完成1-2个FR的主要功能
  - Backend和Frontend各交付2个任务
  - QA验证4-5次

第一个月:
  - 完成4-6个FR
  - V1-实现状态.md显示明显进展
  - 有可演示的成果

文档健康度:
  - .herdr/<30个文件
  - 每个文件都有用
  - 没有过期内容
```

### 8.2 质量指标

```yaml
不降低质量:
  - docs/仍是权威
  - 代码有测试
  - QA独立验证
  - 关键决策有记录

提高稳定性:
  - Architect把关技术
  - Backend/Frontend明确分工
  - QA独立验证
  - 不会出现"做完才发现接口不对"
```

---

## 九、风险和应对

### 9.1 风险

```yaml
R1: Architect成为瓶颈
  应对: Architect只做关键决策，不过度设计
  
R2: Backend/Frontend一个阻塞影响另一个
  应对: 任务尽量独立，有接口契约就可以并行

R3: 5个角色协调仍然复杂
  应对: 流程简化，减少中间文档，每天只检查1次

R4: 清理.herdr/误删有用内容
  应对: 先完整备份，可以恢复
```

---

## 十、决策

**这是平衡方案：5个角色，高效稳定**

理由：
1. ✅ 足够的并行度（Backend + Frontend同时工作）
2. ✅ 明确的分工（不会职责不清）
3. ✅ 技术质量（Architect把关 + QA验证）
4. ✅ 文档精简（<30个文件）
5. ✅ 可以稳定推进V1的15个FR

**立即行动计划**：
1. 今天下午：清理.herdr/（2小时）
2. 今天晚上：重组团队（2小时）
3. 明天：启动第一周工作

**你同意这个方案吗？**
