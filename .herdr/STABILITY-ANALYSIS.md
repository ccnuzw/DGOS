# DGOS团队稳定性改进方案

## 问题诊断

当前9角色团队的**真实风险**：

### 1. 中断风险
- Agent可能超时、崩溃、误解需求
- Lead（我）不是24小时在线的守护进程
- 依赖链复杂时，一个Worker阻塞影响全局

### 2. 反馈机制
- 没有自动通知，Lead需要主动轮询
- Worker完成后可能长时间无人处理
- 失败信息不会自动升级

### 3. 持续性
- 严重依赖Lead的人工介入
- 用户离线时，整个流程停滞

## 改进方案

### 方案A：增加监控Agent（推荐）

**新增角色：Monitor**

```yaml
Monitor (Codex):
  职责:
    - 每30分钟轮询所有Worker状态
    - 检查是否有完成的work-package
    - 自动触发Verify验证
    - 记录阻塞和异常
    - 生成状态报告给Lead
  
  工作循环:
    while True:
      1. 检查delivery-board.yaml
      2. 读取每个Worker的最新报告
      3. 发现"completed" → 通知Verify
      4. 发现"blocked" → 记录并通知Lead
      5. 生成summary写入status/monitor-log.yaml
      6. sleep 30分钟
  
  好处:
    - 减少Lead的检查负担
    - 自动化反馈循环
    - 阻塞会被及时发现
```

### 方案B：使用Herdr的任务通知机制

**利用herdr的features**：

```yaml
Worker完成时:
  - Worker写入完成标记到 .herdr/status/completed/wp-001.done
  - 使用herdr的file watch机制
  - 自动触发Lead检查

实现:
  # .herdr/watch-completion.sh
  inotifywait -m .herdr/status/completed/ |
  while read event; do
    herdr agent prompt lead "检查完成的work-package"
  done
```

但这需要**后台进程**，不太优雅。

### 方案C：明确反馈协议（最实用）

**标准化反馈流程**：

```yaml
Worker完成work-package后:
  1. 提交代码到独立分支
  2. 更新 .herdr/status/current.yaml:
     tasks:
       - id: WP-001
         status: completed
         owner: worker-platform
         completed_at: 2026-10-03T20:00:00
         awaiting: verify
  
  3. 使用herdr通知Lead:
     herdr agent prompt lead "WP-001已完成，等待验证"

Verify验证后:
  1. 运行测试
  2. 更新 .herdr/status/current.yaml:
     tasks:
       - id: WP-001
         status: verified
         result: passed
         verified_at: 2026-10-03T20:30:00
         awaiting: integration
  
  3. 通知Lead:
     herdr agent prompt lead "WP-001验证通过，可以整合"

Lead收到通知后:
  1. 检查current.yaml
  2. 决定是否整合
  3. 更新状态
  4. 派发下一个任务
```

## 推荐实施：方案C + 部分方案A

### 立即改进（今天）

1. **标准化状态文件**

创建 `.herdr/status/current.yaml` 作为**唯一状态源**：
```yaml
tasks:
  - id: WP-001
    title: "Provider账号API"
    owner: worker-platform
    status: working | completed | verified | integrated | blocked
    started_at: ISO8601
    completed_at: ISO8601
    verified_at: ISO8601
    awaiting: verify | integration | none
    blocking_reason: ""
```

2. **Worker标准报告协议**

每个Worker完成后**必须**：
- 更新current.yaml
- 使用 `herdr agent prompt lead "WP-001完成"` 通知

3. **Lead每天检查清单**

```yaml
Lead的每日工作（2次/天）:
  上午10:00:
    - 读取current.yaml
    - 检查所有working状态的任务进度
    - 处理completed任务 → 派发Verify
  
  下午6:00:
    - 读取current.yaml
    - 检查所有verified任务 → 决定整合
    - 检查blocked任务 → 解决或调整
    - 更新周报
```

### 中期改进（下周）

4. **实现简单Monitor**

创建 `.herdr/monitor.mjs`：
```javascript
// 每小时运行一次的监控脚本
import fs from 'fs';
import yaml from 'yaml';

const status = yaml.parse(fs.readFileSync('.herdr/status/current.yaml', 'utf8'));

// 检查是否有任务超过24小时没进展
const stuckTasks = status.tasks.filter(t => {
  const elapsed = Date.now() - new Date(t.started_at);
  return elapsed > 24 * 60 * 60 * 1000 && t.status === 'working';
});

if (stuckTasks.length > 0) {
  console.log('⚠️ 发现阻塞任务:', stuckTasks);
  // 写入alert文件，Lead下次检查时会看到
  fs.writeFileSync('.herdr/status/ALERT.txt', 
    `阻塞任务: ${stuckTasks.map(t => t.id).join(', ')}`
  );
}
```

用cron每小时运行：
```bash
0 * * * * cd /Users/apple/Progame/DGOS && node .herdr/monitor.mjs
```

## 失败处理机制

### Worker失败时

```yaml
场景1: Worker误解需求，做错了
  检测: Verify验证失败
  处理: 
    - Verify报告具体问题
    - Lead决定: 返工 or 取消任务
    - 更新work-package修订号
    - 重新派发Worker

场景2: Worker崩溃/超时
  检测: 24小时没有进展
  处理:
    - Lead检查Worker状态
    - 读取Worker最后的输出
    - 决定: 继续 or 重启Worker or 换Worker

场景3: Worker阻塞在技术问题
  检测: Worker主动报告blocked
  处理:
    - Lead介入分析
    - 咨询Planner或用户
    - 2小时内解决 or 调整任务
```

### Lead离线时

```yaml
用户离线期间:
  - Worker继续工作（独立worktree不冲突）
  - 完成后更新current.yaml
  - 等待Lead回来检查

用户回来后:
  - Lead读取current.yaml
  - 批量处理所有完成的任务
  - 一次性派发Verify
```

## 成功指标和SLA

### 第一周目标

```yaml
反馈速度:
  - Worker完成 → Lead检查: <4小时（工作时间）
  - Lead检查 → Verify验证: <2小时
  - Verify结果 → Lead决策: <2小时
  
阻塞处理:
  - 发现阻塞 → Lead介入: <1天
  - 技术阻塞 → 解决方案: <2小时
  
成功率:
  - Work-package一次通过率: >60%
  - Verify通过率: >80%
  - 周内完成率: >80%
```

### 监控指标

```yaml
每周统计:
  - 派发任务数
  - 完成任务数
  - Verify通过/失败比
  - 平均完成时间
  - 阻塞次数和原因
  - Agent崩溃/超时次数
```

## 现实预期

### 会出现的问题

✅ **承认现实**：
1. Worker会做错事（误解需求、代码bug）
2. Agent会超时/崩溃（Herdr/OpenCode/Codex都可能）
3. Lead不是24小时在线
4. 第一周会有很多调整

### 应对策略

```yaml
快速迭代:
  - 第一周：试运行，快速发现问题
  - 发现问题 → 立即调整流程
  - 不追求完美，优先快速反馈

容错设计:
  - 所有工作在独立worktree
  - 失败可以回滚
  - work-package可以重新派发

人工兜底:
  - Lead（我）每天至少检查2次
  - 用户可以随时介入
  - 关键决策仍需用户确认
```

## 最终答案

### 能保证稳定持续完成吗？

**诚实回答：不能100%保证，但可以做到80%稳定**

**能做到的**：
- ✅ 清晰的任务分配和边界
- ✅ 标准化的反馈协议
- ✅ 快速发现阻塞（<1天）
- ✅ 失败可以恢复和重试

**做不到的**：
- ❌ 完全无人值守（需要Lead每天检查）
- ❌ Agent永不出错（会有误解和bug）
- ❌ 100%自动化（关键决策仍需人工）

### 任务完成后的反馈和后续

**标准流程**：
```
1. Worker完成 
   → 更新current.yaml + 通知Lead
   
2. Lead检查（<4小时）
   → 派发Verify验证
   
3. Verify验证（<2小时）
   → 更新current.yaml + 通知Lead
   
4. Lead决策（<2小时）
   → PASS: 整合到main
   → FAIL: 返工或取消
   
5. 整合后
   → 更新V1-实现状态.md
   → 派发下一批任务
```

**周五总结**：
- Lead生成周报
- 向用户汇报成果和问题
- 规划下周目标

---

**结论**：这个团队设计**适合有人值守的高效协作**，但不是完全自动化的无人系统。需要Lead每天检查2次，用户定期介入关键决策。
