---
title: "06 Canvas 插件与模板扩展技术设计"
version: V5
feature_id: V1-FR-006
delivery_scope: future
planning_only: true
---
# 06 Canvas 插件与模板扩展：技术设计

来源：[功能主文档](01-Canvas插件与模板扩展.md)。

本设计属于 V5 画布生态，不进入 V1 首发门禁；稳定分支 ID 保留用于后续追踪。

## 单元契约

| 函数 | 前置条件 | 返回 | 副作用 |
| --- | --- | --- | --- |
| `validatePlugin(package)` | 包可读 | 协议/权限问题 | 无 |
| `activatePlugin(plugin)` | 校验通过 | 注册结果 | 写隔离存储和节点注册表 |
| `upgradePlugin(plugin)` | 新旧版本可比较 | 新状态 | 失败恢复旧版本 |

## 伪代码

```text
activatePlugin(plugin):
  REQUIRE protocol and permission checks pass
  // B6-01
  register nodes and ports in isolated namespace
  IF registration fails: RETURN Err(PLUGIN_INVALID)
  // B6-02
  run health check before exposing node creation
  RETURN active

upgradePlugin(plugin):
  snapshot old package and isolated data
  // B6-03
  install new package and health check
  IF failure:
    restore old package and snapshot
    RETURN Err(PLUGIN_ROLLBACK)
  RETURN active
```

## 分支到测试追踪

| 分支 | 功能 AC | 跨功能验收 |
| --- | --- | --- |
| B6-01 | 历史 `AC01`，V5 编号待门禁分配 | 拟定 `V5-E2E-02` |
| B6-02 | 历史 `AC01`，V5 编号待门禁分配 | 拟定 `V5-E2E-02` |
| B6-03 | 历史 `AC02`，V5 编号待门禁分配 | 拟定 `V5-E2E-02` |

## 约束备注

插件包不是可信代码；DGOS Permission Service、协议校验和 Extension Runtime 隔离是最终边界。
