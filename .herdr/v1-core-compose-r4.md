# V1-TASK r4：独立Compose真实核心验收

B r3已停写。Lead授权B在主目录仅新增 `scripts/v1-core-compose.mjs`、`tests/integration/core-compose.test.mjs`（按需）及追加 `docs/05-测试与发布/端到端验收/报告/V1-core-*` 成对报告/manifest。产品代码只读，错误报Lead。既有scripts/release-integration和server/worker Lead独占。

Lead已启动独立 `dgos-v1-integration` Compose：postgres15200、redis15201、API15202、Web15203、fixture15204；dgos_v1_integrated容器库，两个独立worker。仅本包暂时独占这组服务/DB执行测试。<=0033已应用30项及0035；0034/0036还在E/H定稿，运行前检查所需schema，缺0036先报Lead等确认不可自己应用未冻结SQL。允许按此project定向restart/stop/kill worker，不操作任何其他Compose或原dgos服务。

实现可重复运行的公开HTTP验收：bootstrap已有时凭显式本轮本地fixture credential登录，不删库；创建本批次唯一Provider account/config；probe成功→显式ready；validate→refresh→enable model→quota policy→submit/replay/SSE/Artifact→cancel→硬额度无Task→两Worker竞争及SIGKILL后unknown不重发。Action独立worker至少设置写入/跨API最新版本/deny拒绝。保留审计/用量/唯一终态不变量，记录真实counts与未知上游状态。fixture使用https://fixture.test/v1映射且禁止外部网络。不要把任何凭据写报告/日志。

报告源码摘要使用 `sourceIdentity` 与关键资产hash，主目录仍并发修改，不能标冻结构建/完整E2E；核验失败保留，不改错误断言。source drift作为限制/失败，不伪装HEAD。工具执行每段bounded timeout，不阻塞Lead >60s。

任务最终报告 `.herdr/V1-TASK-r4.md`，命令/限制；完成停写并归还服务所有权。其他Worker禁止用15200–29直至Lead通知。
