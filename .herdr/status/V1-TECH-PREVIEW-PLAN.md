# V1 Tech Preview 完成计划（务实版）

**目标**: 2-3天内交付Web MVP Tech Preview
**定位**: 不称为正式V1，而是"V1 Tech Preview"

---

## Day 1: 冻结Web候选并修复关键问题（明天）

### 上午（4小时）
**Worker-DevOps + Worker-Test**:
1. 冻结Web候选代码
2. 生成候选manifest
3. 运行完整E2E验证
4. 识别所有FAIL项

### 下午（4小时）
**Worker-AI + Worker-Web**:
1. 修复E2E发现的关键问题
2. 确保Provider→Task→SSE→Artifact链完整work
3. 修复500错误和超时
4. 重新验证

---

## Day 2: 完成验证并准备交付（后天）

### 上午（4小时）
**Worker-Test + Verify**:
1. 基于修复重新运行完整验证
2. 生成最终验证报告
3. Verify审核并给出结论

### 下午（4小时）
**Planner + Worker-Platform**:
1. 更新V1-实现状态.md（标记为Tech Preview）
2. 编写Tech Preview说明文档
3. 准备演示脚本

---

## Day 3: 演示和发布（第三天）

### 上午（3小时）
**Worker-Platform**:
1. 录制演示视频
2. 准备Tech Preview发布说明

### 下午（2小时）
**Worker-DevOps**:
1. 准备Docker Compose部署包
2. 编写快速开始文档
3. 标记为"v1-tech-preview"

---

## 交付物

### 必须有
- ✅ Web版可运行的Demo
- ✅ Provider→Task→SSE→Artifact完整演示
- ✅ 演示视频（5-10分钟）
- ✅ Tech Preview文档

### 明确说明
- ⚠️ 这是Tech Preview，不是正式版
- ⚠️ Native版仍在开发中
- ⚠️ 已知限制清单
- ⚠️ 正式V1预计1-2周后

---

## 验收标准（Tech Preview级别）

### 必须满足
- [x] Web版可启动并访问
- [x] 能配置至少1个Provider
- [x] 能提交文本Task并看到结果
- [x] SSE流式输出工作
- [x] Artifact可查看

### 可以接受的限制
- [ ] Native版未完成
- [ ] 部分FR只有基础实现
- [ ] 真实外部Provider可能有限制
- [ ] 性能未优化
- [ ] 文档不完整

---

## 并行度

**Day 1**:
- Worker-DevOps + Worker-Test (验证)
- Worker-AI + Worker-Web (修复)

**Day 2**:
- Worker-Test + Verify (最终验证)
- Planner + Worker-Platform (文档)

**Day 3**:
- Worker-Platform (演示)
- Worker-DevOps (发布)

---

## 风险管理

### 如果验证仍然失败
- 选项1: 用Mock Provider演示
- 选项2: 接受部分功能work
- 选项3: 延长1天修复

### 如果时间不够
- 优先: 核心演示链
- 可延后: 文档细节
- 可延后: 演示视频美化

---

## 成功定义

**不是**: 完整V1正式版
**而是**: 
- 可演示的Web MVP
- 诚实的Tech Preview
- 为正式V1打下基础
- 时间可控（2-3天）
