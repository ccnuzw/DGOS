# Context-pack：WP-W4-01 V1 最终集成验证

## 目标

以最终候选构建为唯一输入，验证 V1 MVP 核心链和平台最小支撑：Web AI Task、FR-002/003/009、FR-001 Web/Native smoke、权限/秘密/回滚关键失败分支。

## 当前缺口

- V1 实现状态仍主要是本地验证，12 项首发 E2E 没有统一 Passed 结论。
- W3-04 仍在运行；Native W3-02 仍在修复。
- Web W3-01 已完成代码/UI，但真实 Provider E2E 尚需 Worker-AI fixture/server 和环境变量。

## 证据规则

每批必须绑定 commit、源码/构建/资产 hash、migration、环境、命令、结果和 limitations；Web 与 Native 不合并伪造单一通过。
