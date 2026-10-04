# V1完善修复计划 - 具体行动方案

**目标**: 1-2天内完成V1可交付状态
**策略**: 并行修复 + 分阶段验证

---

## Phase 1: 立即修复关键阻塞（今晚，3-4小时）

### 任务1: 修复Web Provider 500错误（P0，阻塞验证）
**Owner**: Worker-AI
**问题**: Web E2E中未知Provider config返回500
**具体行动**:
1. 读取Worker-Test的错误日志，找到500的具体原因
2. 检查Provider配置API路由
3. 修复API错误处理
4. 重新运行E2E测试验证

**预计**: 1-2小时

### 任务2: 修复Assistant UI超时（P1）
**Owner**: Worker-Web
**问题**: Assistant selector缺失导致超时
**具体行动**:
1. 检查apps/web/src中Assistant UI代码
2. 补充缺失的selector
3. 验证UI渲染

**预计**: 30分钟

### 任务3: Native bridge loopback方案（P0）
**Owner**: Worker-Native（正在工作）
**问题**: Wry iframe无法加载Workbench
**当前方案**: 实现loopback HTTP resource server
**具体行动**:
1. 实现受限loopback HTTP server
2. 用launch ticket校验
3. 转发到API proxy
4. 测试iframe加载

**预计**: 2-3小时

---

## Phase 2: 冻结候选并验证（明天上午，2-3小时）

### 任务4: 冻结代码候选
**Owner**: Worker-DevOps
**具体行动**:
1. 提交Phase 1的所有修复
2. 创建V1候选分支: v1-candidate
3. 锁定依赖版本
4. 生成候选manifest

**预计**: 30分钟

### 任务5: 完整集成验证
**Owner**: Worker-Test + Verify
**具体行动**:
1. 基于冻结候选运行完整测试套件
2. Web E2E完整通过
3. Native基础验证（如果Phase 1完成）
4. 生成最终manifest和证据

**预计**: 1-2小时

---

## Phase 3: 文档和交付（明天下午，2-3小时）

### 任务6: 状态回写和文档
**Owner**: Planner
**依赖**: Phase 2验证通过
**具体行动**:
1. 更新V1-实现状态.md
2. 回写FR完成状态
3. 生成V1完成报告

**预计**: 1小时

### 任务7: 演示和发布
**Owner**: Worker-Platform + Worker-DevOps
**具体行动**:
1. 录制演示视频
2. 准备V1发布包
3. 编写部署文档

**预计**: 2小时

---

## 并行度规划

**今晚（Phase 1）**:
```
Worker-AI      → 修复Web 500错误（P0，阻塞）
Worker-Web     → 修复Assistant UI
Worker-Native  → Native loopback方案（进行中）
Worker-Test    → 准备验证fixture
```

**明天上午（Phase 2）**:
```
Worker-DevOps  → 冻结候选
Worker-Test    → 完整验证
Verify         → 验证报告
```

**明天下午（Phase 3）**:
```
Planner        → 状态回写
Worker-Platform → 演示视频
Worker-DevOps  → 发布准备
```

---

## 阻塞升级机制

**如果遇到阻塞，立即向你反馈**：

1. **Native loopback方案失败** → 
   - 反馈：Worker-Native遇到技术障碍
   - 你的选项：定向解决 或 标记Native延后

2. **Web 500错误难以修复** →
   - 反馈：Worker-AI需要更多上下文
   - 你的选项：提供更多信息 或 跳过该测试

3. **验证仍然失败** →
   - 反馈：具体失败项
   - 你的选项：继续修复 或 接受部分通过

---

## 成功标准

### 最小可交付（必须）:
- ✅ Web版Provider→Task→SSE→Artifact完整演示
- ✅ FR-002/003/009完整实现
- ✅ E2E测试主流程通过
- ✅ 文档完整

### 理想状态（争取）:
- ✅ Native Workbench基础可用
- ✅ 完整验证矩阵全通
- ✅ 演示视频高质量

---

## 时间线

**今晚23:00** - Phase 1关键修复完成
**明天10:00** - Phase 2验证完成
**明天18:00** - Phase 3交付完成

**总计**: ~24小时
