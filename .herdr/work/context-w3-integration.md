# Context-pack：Wave 3 集成验证

## 目标

以 `f14a3c9` 为统一候选基线，验证 Web MVP、扩展/助手基础链、Provider Task 链和 Native smoke；所有证据绑定代码、dist、migration 和环境。

## 约束

- 局部 fixture、mock、历史构建不得拼接为候选通过。
- Web 与 Native 证据分开；Native 不通过不能掩盖 Web 结论。
- 失败批次保留，报告明确排除项和限制。
