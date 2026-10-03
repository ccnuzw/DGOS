# DGOS团队启动指南

## ✅ 准备完成

团队配置已就绪：
- ✅ `team.json` - 9角色配置
- ✅ 9个角色文件（roles/）
- ✅ `status/current.yaml` - 当前状态

## 🚀 启动方式

### 方式1：使用Herdr UI启动（推荐）

在Herdr界面中：
1. 打开DGOS workspace (wJ)
2. 点击"Create Agent"或类似按钮
3. 选择team.json或逐个创建agents

**需要创建的agents**：
- `planner` (OpenCode)
- `worker-platform` (Codex)
- `worker-ai` (Codex)
- `worker-web` (Codex)
- `worker-native` (Codex)
- `worker-test` (Codex)
- `worker-devops` (Codex)
- `verify` (Codex)

### 方式2：命令行启动

如果herdr支持team加载：
```bash
cd /Users/apple/Progame/DGOS
herdr team load .herdr/team.json
```

或逐个创建：
```bash
herdr agent create planner --kind opencode
herdr agent create worker-platform --kind codex
herdr agent create worker-ai --kind codex
herdr agent create worker-web --kind codex
herdr agent create worker-native --kind codex
herdr agent create worker-test --kind codex
herdr agent create worker-devops --kind codex
herdr agent create verify --kind codex
```

## 📋 启动后第一步

1. **Lead（我）定义第一周目标**
   
2. **派发Planner任务**：
   ```bash
   herdr agent prompt planner "读取docs/02-产品与版本/当前版本/V1-实现状态.md，评估15个FR的真实进度，使用spec-docs生成第一周的工作计划。优先选择1-2个最需要推进的FR。"
   ```

3. **等待Planner完成**，然后分配work-package给Workers

## 🎯 预期工作流

```
周一：Lead → Planner → 生成work-package
周二-周四：派发给6个Workers并行工作
         每个Worker完成 → Verify验证（4小时内）
周五：Verify完整测试 → Lead总结汇报
```

---

**当前状态：配置完成，等待启动agents**

**Lead准备就绪！** 告诉我何时启动，或者你在Herdr中创建agents后，我们就可以开始工作了。
