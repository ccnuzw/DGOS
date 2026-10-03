# Context-pack：WP-W2-03 Web 主链 E2E

## 目标

独立建立 Provider→Task→SSE→Artifact 的真实 Web E2E 验收资产，可在 WP-W2-01 完成前先写 fixture、断言和失败分支。

## 范围

覆盖登录、Provider 验证/模型选择、Task 提交、重复 requestId、SSE 断线 cursor/query 恢复、取消/失败、Artifact 结果和秘密扫描。

## 约束

测试不能把 mock 通过写成真实候选通过；每批绑定 code/dist/环境 manifest。当前仓库既有全量测试存在服务依赖失败，必须隔离并清楚报告排除项。
