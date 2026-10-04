# V1完整候选完成计划（5-8天）

**目标**: Web + Native双宿主完整候选版本
**时间**: 5-8天
**定位**: 满足V1核心验收标准的候选版本

---

## Week 1: 核心功能完善（5天）

### Day 1: 冻结当前基线并评估FR缺口（明天）

**上午（4小时）- Planner**:
1. 详细评估15个FR的AC缺口
2. 为每个FR生成缺口work-package
3. 排序优先级：门禁 > 重要 > 可延后

**下午（4小时）- Worker-DevOps + Worker-Test**:
1. 冻结当前代码为baseline
2. 运行完整验证，建立基线
3. 生成详细的FAIL清单

**产出**: 
- 15个FR的详细缺口清单
- 基线验证报告
- 优先级排序的work-packages

---

### Day 2-3: FR-005/007核心链完善（2天）

**目标**: Provider→Task→SSE→Artifact完整达标

**Worker-AI（P0，关键路径）**:
1. 修复Provider 500错误和超时
2. 真实外部Provider完整验证
3. Task创建、SSE、Artifact完整链路
4. 幂等、断线恢复、错误处理
5. 满足FR-005/007的所有AC

**Worker-Test（并行）**:
1. 编写完整E2E测试
2. 覆盖成功/失败/取消/超时场景
3. 真实Provider fixture

**验收标准**:
- [ ] 真实Provider配置和验证
- [ ] 模型目录查询正确
- [ ] Task提交成功并返回taskId
- [ ] SSE增量单调有序
- [ ] 断线后cursor恢复
- [ ] Artifact持久化并可读取
- [ ] quota reservation/settlement正确
- [ ] E2E测试全通

---

### Day 4: FR-001 Native完善（1天）

**目标**: Native Workbench完整可用

**Worker-Native（P0）**:
1. 完成loopback HTTP方案
2. 验证iframe加载和dgos.app.ready
3. bridge handshake完整
4. Task/Artifact在Native中work
5. 真实窗口截图和证据

**验收标准**:
- [ ] macOS前台窗口正确
- [ ] Workbench内容可见（非空白）
- [ ] iframe/bridge handshake成功
- [ ] 能在Native中提交Task并看到结果
- [ ] 有完整截图和manifest证据

---

### Day 5: FR-002/003/009完善（1天）

**目标**: 开发者中心、扩展、助手完整

**Worker-Platform（上午）**:
- FR-002: 应用目录浏览器完整UI
- FR-003: Skill/MCP权限UI和Run恢复
- 真实浏览器验证

**Worker-Web（下午）**:
- FR-009: Assistant UI完整
- 快捷指令选择和执行
- 确认/取消/历史脱敏

**验收标准**:
- [ ] 应用目录可浏览
- [ ] Skill读取权限ask/deny/allow有UI
- [ ] MCP连接和工具发现work
- [ ] Assistant快捷指令可选择和执行
- [ ] 所有E2E通过

---

## Week 2: 集成验证和交付（2-3天）

### Day 6: 统一候选冻结和完整验证（1天）

**上午 - Worker-DevOps**:
1. 冻结统一候选
2. 创建v1-release-candidate分支
3. 锁定所有依赖版本
4. 生成候选manifest

**下午 - Worker-Test + Verify**:
1. 基于冻结候选运行完整验证矩阵
2. Web E2E完整流程
3. Native完整验证
4. 所有FR的验收测试
5. Migration、性能、安全检查

**验收标准**:
- [ ] 候选代码已冻结
- [ ] 依赖版本已锁定
- [ ] 完整验证矩阵执行
- [ ] Verify给出PASS/FAIL结论

---

### Day 7: 修复验证发现的问题（1天）

**根据Day 6验证结果**:
- 派发相关Workers修复FAIL项
- 重新验证修复
- 迭代直到主要问题解决

**如果发现重大问题**:
- 评估是否阻塞V1
- 决定修复或标记为known issue

---

### Day 8: 文档、演示、发布准备（1天）

**上午 - Planner**:
1. 更新V1-实现状态.md
2. 回写FR完成状态
3. 生成V1完成报告
4. 已知限制清单

**下午 - Worker-Platform + Worker-DevOps**:
1. 录制演示视频
2. 准备Docker Compose发布包
3. 编写部署文档
4. signed macOS build（如果Native完成）

---

## 并行度规划

### Day 1: 2个Workers
- Planner: FR缺口评估
- Worker-DevOps + Worker-Test: 基线验证

### Day 2-3: 3-4个Workers
- Worker-AI: FR-005/007（关键路径）
- Worker-Test: E2E测试（并行）
- Worker-Native: 可以开始准备

### Day 4: 2个Workers
- Worker-Native: Native完善（关键）
- Worker-Test: Native验证

### Day 5: 3个Workers
- Worker-Platform: FR-002/003
- Worker-Web: FR-009
- Worker-Test: 验证

### Day 6: 3个Workers
- Worker-DevOps: 冻结候选
- Worker-Test: 完整验证
- Verify: 审核

### Day 7: 按需派发
- 根据验证结果动态分配

### Day 8: 3个Workers
- Planner: 文档
- Worker-Platform: 演示
- Worker-DevOps: 发布

---

## 关键里程碑

**Day 3结束**:
- ✅ FR-005/007完整work（关键门禁）

**Day 5结束**:
- ✅ 所有核心FR基本完成
- ✅ Web版完整可用
- ⚠️ Native可能仍有小问题

**Day 6结束**:
- ✅ 统一候选冻结
- ✅ 完整验证执行
- ✅ 知道所有FAIL项

**Day 8结束**:
- ✅ V1候选版本完成
- ✅ 文档和演示ready
- ✅ 可以标记为Release Candidate

---

## 风险管理

### 高风险项
1. **Native bridge可能仍然blocked**
   - 缓解: Day 4集中攻坚
   - Plan B: 延长1-2天
   - Plan C: V1只交付Web版

2. **FR-005/007可能有深层问题**
   - 缓解: Day 2-3全力修复
   - Plan B: 用部分Provider演示

3. **验证发现重大缺陷**
   - 缓解: Day 7留足修复时间
   - Plan B: 标记为known issue

### 时间弹性
- 最快: 5天（一切顺利）
- 正常: 6-7天（有小问题）
- 最慢: 8天（有中等问题）
- 如果>8天: 重新评估范围

---

## 成功标准

### 必须达到
- [ ] Web版满足V1核心验收场景
- [ ] FR-001/002/003/005/007/009完整work
- [ ] 统一冻结候选通过完整验证
- [ ] 有演示视频和完整文档

### 理想达到
- [ ] Native版基础可用
- [ ] 所有15个FR（除004/006/008）达标
- [ ] 可以signed发布

### 可接受的限制
- Native版可能仍有minor issues
- 部分高级功能未完成
- 性能未完全优化

---

## 交付物

1. **代码**:
   - v1-release-candidate分支
   - 冻结的统一候选

2. **验证**:
   - 完整验证报告
   - Verify审核结论
   - 已知限制清单

3. **文档**:
   - V1-实现状态.md（更新）
   - 部署文档
   - 已知问题列表

4. **演示**:
   - 5-10分钟演示视频
   - 演示脚本

5. **发布包**:
   - Docker Compose包
   - macOS signed build（如果完成）
