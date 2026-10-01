<!-- doc-template: true -->

# E2E 证据报告目录

本目录存放各批次与专项的**脱敏证据制品**：测试报告、日志片段、截图、查询计划等。只追加、不覆盖；失败批次保留原记录。

## 命名规范

| 类型 | 规范 | 示例 |
| --- | --- | --- |
| 批次报告 | 版本-日期-时间-环境.json | `v1-20260928-1959-local-mock.json`（仅命名示例，非实际报告） |
| 专项制品 | 主题-日期-时间-资产.扩展名 | `assistant-20260928-1959-flow.json`（仅命名示例） |
| 运行清单 | run_id 加 `-manifest.json` | `v1-20260928-1959-local-mock-manifest.json`（仅命名示例） |

## Manifest 最小字段

每个批次报告必须有一份 manifest，字段固定。证据 commit 指向实际测试的源码提交；报告、manifest 与证据指针可在该提交之后追加，但之后不得再有源代码变更：

| 字段 | 记录要求 |
| --- | --- |
| `run_id`、`environment`、`started_at` | 唯一批次、环境及依赖模式、带时区开始时间 |
| `code_version`、`commit`、`asset_sha256` | 被测构建、完整源码提交及被测源码/脚本的校验和映射 |
| `command`、`working_directory`、`exit_code` | 实际命令、执行目录和退出码 |
| `stats`、`test_report` | expected/passed/failed/skipped/unexpected/flaky 计数及同目录报告名 |
| `cleanup`、`sanitization`、`scope`、`limitations`、`prior_attempts` | 清理、脱敏、覆盖范围、不能证明的结论和先前尝试 |

当前目录没有 DGOS E2E 执行报告或 manifest；字段表是制作要求，不是执行结果。

## 规则

1. 报告与 manifest 只追加不覆盖；重跑生成新 run_id，不修改旧文件。
2. 不包含密钥、令牌、签名 URL、完整请求体或未脱敏数据；截图与日志同理。
3. `limitations` 必须写清不能证明的结论，防止本地证据被当成生产门禁。
4. `asset_sha256` 用于证明报告与当时的源码/脚本版本对应。
5. 批次结论登记到[验证证据](../验证证据.md)，本目录只放制品。
