# V1-ACTIONS r4：能力授权事务与应用动作联动

A r3已停写，Lead修onReady后candidate/governance公开测试3/3。A主目录授权 `src/permissions/`、`src/actions/registry.mjs`、新 `src/actions/package-actions.mjs`及独立权限/动作专项测试；不动Lead runtime.mjs/candidate-routes.mjs/server/worker，System r3代码冻结。

PermissionBroker.decide目前先仓储set再audit，批准request先消耗再decide，audit/权限写失败会留下授权/请求不一致；按FR001/009/014补同事务outbox、并发幂等与deny优先。接口仍给Lead当前requireScope/scopedBody，App声明不能来自任意请求declared字符串绕过真实manifest。

G提供onActionsChanged({subjectId,appId,manifest,enabled})，实现从有效安装manifest.action声明加载/撤销持久Registry及可调用handler绑定（server-owned，不能任意脚本），跨API/Worker版本一致，卸载一主体不误删其他主体可用动作。给Lead精确factory/hydrate入口。使用既有声明schema，发现字段冲突报Planner先收敛。

专属actions库/15101-09，新增SQL若必要用0038-permission-action-lifecycle.sql，旧不改。报告.herdr/V1-ACTIONS-r4.md并停写，不提交推送。
