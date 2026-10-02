# V1-GOV r4 公共入口回归资产

- status: partial（本包测试资产完成，跨域 Provider 用例仍失败）
- work_package: V1-GOV-r4 / DGOS-V1-IMPLEMENT-20261002
- cwd: `/Users/apple/Progame/DGOS`
- scope: 仅测试文件；产品源码、`server.mjs`、`worker.mjs`、Lead 的 `governance-wiring` 测试均只读

## 测试资产变更

- `tests/integration/identity-api.test.mjs`：使用注入时钟证明错误凭据首错 401、退避中 429、时间前进后可再次收到 401；不再要求连续五次均为 401。
- `tests/integration/retention-api.test.mjs`：先从服务器 GET preview 取得 digest，提交确认后创建并运行作业。
- `tests/integration/postgres-retention.test.mjs`：旧直接仓储用例显式创建已确认作业，保留分批清理、审计失败回滚和未发布 outbox 保护断言。文件中此前 r1/r2 的其他修改未覆盖。
- `tests/security/v1-governance-e2e.test.mjs`：E2E-14 先取得服务器预览，再用 digest 创建并执行保留作业；E2E-12 的有限轮换窗口断言保留，Provider E2E-13 未修改。

## 命令与结果

- 内存公开 API 完整定向命令：`node --test tests/integration/identity-api.test.mjs tests/integration/retention-api.test.mjs tests/security/v1-governance-e2e.test.mjs tests/security/governance-hardening-r3.test.mjs tests/integration/governance-wiring.test.mjs`。exit 1，10/11 通过；身份/治理 10 项均通过。失败为 V1-E2E-13 Provider connection test，30 秒后状态 500，旧断言期望 202，位于 `tests/security/v1-governance-e2e.test.mjs:59`。本包没有修改 Provider 测试段或产品实现，需 Lead/Provider owner 定位。
- 限定身份与治理用例的同组命令加 `--test-name-pattern='V1-E2E-1[124]|identity and API key|retention sweep|stale session|API key management|login audit|subject/source|retention plan'`：exit 0，10/10，通过且无 skip。覆盖 Key 轮换/撤销、会话续期不刷新 authFresh、scope 委派、审计失败无 session 副作用、保留确认。
- 专属库顺序测试：`DGOS_DATABASE_URL=postgresql://dgos:dgos@127.0.0.1:5432/dgos_v1_governance node --test --test-concurrency=1 tests/integration/postgres-identity.test.mjs tests/integration/postgres-retention.test.mjs tests/integration/postgres-governance-policy.test.mjs tests/integration/postgres-governance-hardening-r3.test.mjs`。exit 0，6/6。未操作 integrated/original `dgos` 库，未触碰 15200 端口组。
- `git diff --check -- <4 authorized test paths>`：exit 0。

## 证据边界与交接

Lead 所述公共入口接线和 onReady 修复在本轮测试时存在；`governance-wiring` 本次实测 2/2，通过。当前源码及其他域可能在并行整合，以上结果仅绑定本次命令时工作树，不是发布或生产证据。Provider E2E-13 的 500 是本轮唯一公开 API 失败，不能把限定治理用例的 10/10 宣称为整套测试通过。

files_changed: [tests/integration/identity-api.test.mjs, tests/integration/retention-api.test.mjs, tests/integration/postgres-retention.test.mjs, tests/security/v1-governance-e2e.test.mjs, .herdr/V1-GOV-r4.md]
tests_added: []
implementation_facts: [退避与保留确认回归资产已适配冻结语义；本包未修改产品实现]
contract_changes_proposed: []
open_risks: [Provider E2E-13 返回 500；完整跨域/生产验收未完成]
docs_to_update: [FR-010/011/014 验证记录与 V1 实现状态由 Lead/Planner 根据整合证据回写]
needs_lead_or_planner_decision: []
