# V1-DESKTOP r3 主目录真实集成准备

F r2已停写，主目录apps/desktop与host-adapter/macos仍F独占，D已经主目录Web build。继续实际共享dist构建/原生入口、窗口恢复及Session边界，不覆盖D前端。

先修可见代码问题：on_page_load多次添加popstate监听、history替换可能在前端加载前导致路由丢失；workspace全局未按主体隔离；本地代理HTTP localhost origin允许性要限定实际tauri资源，不能无界同源提权。SDK/window open与已授权installed app、导航路由的接口需D/Lead协调，不能任意label生成与应用无关的窗口。

原生GUI fixture已证明PID/API请求但窗口计数权限不足，不回退掩盖正式GUI验收。可用已有本机工具真实截图/窗口证据时执行并标证据等级；没有辅助功能权限也先完成可运行构建与网络/会话E2E资产，准确记录限制。

共享API仍整合，后续Lead提供独占测试API端口。在此之前可用本包fixture15151–15159核验钥匙串保存/重开会话/撤销（仅测试专属service/account，禁止读删用户其他凭据），并提供脚本外部API模式以备真实登录和Task。r3禁止修改root依赖和生产I文件。

报告 `.herdr/V1-DESKTOP-r3.md`，命令结果/限制，停写。不提交推送。
