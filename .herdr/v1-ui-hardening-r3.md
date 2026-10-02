# V1-UI r3 主目录完整页面链路

r2已交接停写，Lead授权主目录原D路径继续，F独占desktop/macos，Lead持有所有服务端。先按已整合API实际请求修页面，禁止全成功mock替代真实链路。

1. Provider账号credential_pending必须经显式受控启用/连接验证路径成为ready再任务准入；H正在给具体接口。增加账号状态/连接测试/归属/删除和模型策略状态可见操作，验证/刷新分离不变。
2. Key轮换、过期、撤销；session重认证/退出/会话查询恢复。高风险step_up_required须可返回登录重认证后恢复操作，不存秘密。Auth principalHint已修保留。
3. Governance用GET /api/v1/admin/governance/retention-preview取服务器摘要，展示预览再显式确认start+run；不能要求用户手填digest。policy读改baseVersion，与C接口对齐；quota policy不能只JSON展示，按现有schema受控编辑。
4. 安装/启动使用G实际launch receipt.entry/资源sandbox，不能仅返回成功toast；官方应用与安装状态分开显示。扩展真实preview/版本/config/connect/tools/invoke/cancel必须可操作，确认票据流程由E/Lead接（schema先对齐）。
5. 读取主OpenAPI actions/resolve 单一候选DTO（text/requestId→candidates actionId/actionVersion/input/risk/permission/executable:false），提供快捷/自然语言输入，只plan/confirm后执行；受控五导航目标已接保留。Lead会接resolver路由。
6. 完整zh/en翻译（当前页面不少硬编码英文），键盘modal focus/esc、倍率75–175和错误/空/加载；所有API请求形成正确body，表单不是源码JSON唯一入口（开发者签名包导入例外）。

可分小片给Lead接线，报告 `.herdr/V1-UI-r3.md`，真实build/browser结果（fixture和real分开）。你端口15131–15139，暂不使用Lead15200–15229。在API服务尚未就位时先domain fixture验证，real等待Lead明确可用url。完成停写，不提交推送。
