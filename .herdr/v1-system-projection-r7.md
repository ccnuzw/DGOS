# V1-SYSTEM r7 / Worker-C

C quota r6已停写，Lead将主目录src/system与新apps/api/src/system-routes.mjs及本领域专项测试授权C。A当前只actions/permissions不写system，server/worker仍Lead所有。

按P0-DOC-r2及V1-公共HTTP投影与内部适配落实System唯一HTTP转换：PATCH {requestId,baseVersion,domain,patch}，响应顶层appearance/locale/network/grid等，拒旧嵌套domain/value。内部旧mode/language可迁移，必需设置值真实初始化与保存；locale回退、projectContentLanguage独立、scale倍率0.75–1.75、grid按schema有界；network已保存待重启必须反映真实旧effectiveRoute，缺实际代理接线不得假称生效。context app实例必须有权真实绑定，控制面自身可明确dgos.system，不伪造任意window状态。

独立export registerSystemRoutes(app,{system,readAuth,writeAuth,...必要依赖})供Lead替换4个inline routes，内部SystemService保持A Action调用兼容。保证版本冲突/并发/审计事务与requestId幂等不退化，SSE context events按游标返回。设置已有存储JSON可明确受控upgrade/初始化，若SQL必要0042-system-projection.sql（编号独占先冻结再迁）。

主目录新tests/integration/system-http-projection.test.mjs及既有system-cross-process测试可改，tests/integration/runtime-api.test.mjs当前Lead未派owner，可以同包改System部分，应用部分勿覆盖。专属dgos_v1_governance测试，勿integrated。交.herdr/V1-SYSTEM-r7.md含Lead接线与D字段，先给稳定接口再完成测试。禁止提交推送。
