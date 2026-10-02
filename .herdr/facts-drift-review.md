# facts 漂移只读复核

- status: ready（仅漂移清单交付，不作状态变更或产品验收）
- work_package: Lead追加的facts漂移只读复核 / revision 1 / 2026-10-02；P0-DOC r3保持封存。
- slice_id: V1-platform、V1-ai-task、V1-assistant、V1-governance
- objective: 列明11项implementation_status的from/to和唯一来源，供Lead最后一次定向patch。
- authority_files: docs/02-产品与版本/当前版本/V1-实现状态.md的“状态总表”；docs-facts.json为待校正派生值；scripts/facts-sync.mjs为枚举转换规则。
- dependencies: Lead最终决定及应用patch；本报告不重新核验历史产品证据。
- parallel_work_packages: 无；只写本报告。
- blocking_decisions: 无新增业务决策；若Lead变更唯一状态源，应按变更后状态重新派生。
- required_writeback: Lead仅按功能ID定位目标字段、核对源值后一次patch；Planner不写facts/实现状态/证据，不升任何状态。

## 结论及唯一来源

实际执行`node scripts/spec-docs.mjs facts-sync --check --json`，exit 0，返回read_only=true、written=false、derived_features=12、findings=11（drift=11、missing=0、orphan=0）。非strict模式即使发现漂移也exit 0，不能解释为零漂移。

下表from是当前docs-facts.json实际值；to是工具从**已存在的唯一状态总表**派生的expected值，尚未应用，也不是本次建议提升产品成熟度。唯一来源文件[ V1-实现状态.md ](../docs/02-产品与版本/当前版本/V1-实现状态.md)第5、42行声明自身权威；派生器第94–104行按“功能 ID / 实现状态”列取值，第128行赋给implementation_status。功能主文档的Ready、r3规格检查、Worker回执、代码存在和schema正反例均不参与这个状态映射。

| 功能ID | facts字段位置（本次快照） | from | 唯一状态总表原值 | to（仅派生目标） | 状态源行号 |
| --- | --- | --- | --- | --- | ---: |
| V1-FR-001 | /facts/0/implementation_status | planned | 基础实现 | implemented | 11 |
| V1-FR-002 | /facts/1/implementation_status | planned | 基础实现 | implemented | 12 |
| V1-FR-005 | /facts/4/implementation_status | planned | 本地验证 | locally_verified | 14 |
| V1-FR-007 | /facts/6/implementation_status | planned | 本地验证 | locally_verified | 15 |
| V1-FR-009 | /facts/8/implementation_status | planned | 基础实现 | implemented | 16 |
| V1-FR-010 | /facts/94/implementation_status | planned | 部分实现 | partial | 17 |
| V1-FR-011 | /facts/95/implementation_status | planned | 部分实现 | partial | 18 |
| V1-FR-012 | /facts/96/implementation_status | planned | 部分实现 | partial | 19 |
| V1-FR-013 | /facts/97/implementation_status | planned | 基础实现 | implemented | 20 |
| V1-FR-014 | /facts/98/implementation_status | planned | 部分实现 | partial | 21 |
| V1-FR-015 | /facts/99/implementation_status | planned | 本地验证 | locally_verified | 22 |

共4项implemented、3项locally_verified、4项partial。脚本枚举规则位于[scripts/facts-sync.mjs](../scripts/facts-sync.mjs)第74–76行：本地验证→locally_verified，部分实现→partial，基础实现→implemented。implemented在这里仅表示“基础实现”，不能解释为完成；locally_verified不代表真实外部依赖或发布通过；partial保留未覆盖部分。状态原文定义见唯一状态源第38–41行。

V1-FR-003是第12项active功能，唯一状态源第13行为规划中，/facts/2/implementation_status=planned，双方一致，不在11项diff中。FR004/006/008为future，不纳入本次校正。派生器本轮未报告其他字段漂移。

## Lead一次patch的最小边界

1. 通过facts[].id定位上表11项，并确认当前implementation_status仍等于from；数组下标只用于定位本次快照，不能在并发变动后直接套用。
2. 如果唯一状态总表原值仍与上表一致，只改这11个implementation_status到对应to。保留spec_status、lifecycle、delivery_scope、delivery_slice、authority、references、evidence及所有其他事实。11项当前evidence均为[]；本次不生成或补造证据。
3. facts[].authority继续指向功能规则主文档；implementation_status的派生源单独由唯一实现状态表承担。为消漂移而把authority改成实现状态表会混淆规则来源，不属于本次patch。
4. 不用facts-sync --write代替定向patch：其第154–169行会同步多个派生字段、references和updated。应用后可只读复查facts-sync --check --json，核对这11项消失且未产生其他非预期变更；若源已变化则重新比较，不强套本表。

唯一状态表更新时间仍为2026-10-01，包含历史差距摘要。本次只核对其权威状态栏与派生器，不宣称这些历史产品证据适用于当前并发源码。R3规格/schema通过与产品运行、独立Verify、完整AC、发布证据继续分开；状态同步本身不能关闭差距或发布门禁。

## 快照与执行限制

本次读取/散列时的SHA256：

| 文件 | SHA256 |
| --- | --- |
| docs-facts.json | 4ce9f3042ac44713f24391c7e860b2e9da5d76e540266a4f6a97ceeb703f6663 |
| docs/02-产品与版本/当前版本/V1-实现状态.md | 816866d68f4b3d40014654ff347e89f132514619f3fece9e9af263aea9537cc7 |
| scripts/facts-sync.mjs | 362c89a6ae2e77ad9be7eaa6cc54c30c74abaaadfff0c3205b6240af4e0a3112 |

命令结果与逐项JSON字段定位均为本次只读实际输出。唯一写入为本报告；未执行--write、产品测试、实现状态变更、证据写入或提交。next_action：Lead核对快照后执行最终一次patch。
