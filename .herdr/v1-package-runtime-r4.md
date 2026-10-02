# V1-PACKAGES r4：实际应用运行与数据生命周期

r3已交接停写，Lead已替换旧apps路由并挂ready。继续主目录src/apps（**runtime-config.mjs Lead独占**）、package-routes及本领域测试，新增 `scripts/build-bundled-app.mjs`、`apps/ai-workbench-package/` 为唯一示范APP分发源码。D拥有Web/SDK调用UI，不覆盖。

完成现有FR002剩余：提供真正可启动的官方DGOS AI工作台包构建（复用共享Web构建资产/已冻结入口，不加第二套业务逻辑），operator显式签名key，测试可临时fixture key，不能在生产自动信任自己生成key。实际sandbox资源须能加载模块/样式且不能同源读取管理cookie/任意API；跨opaque origin SDK桥接只能受控声明能力、主体、app实例绑定。先给Lead/D最小握手接口，再实现server端受控入口；不得把完整控制面同权限装进第三方iframe。

dataMigration按已冻结manifest声明给受控可逆执行与回滚记录，不能无限期data_migration_required。若规格不足列字段精确缺口交Planner；普通工程选择自主推进。旧记录保留/验证映射按Planner规则，不改历史SQL；若新SQL用0037-app-data-migration.sql。

健康probe提供实际浏览器或runtime handshake验证测试，不把<html标记当健康。补真实包更新回滚/卸载保数据链路。专属packages库/15161-69，本包可用浏览器临时server；报告.herdr/V1-PACKAGES-r4.md并停写。不提交推送。
