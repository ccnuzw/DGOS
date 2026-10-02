# V1-NETWORK r5 / I：统一有效代理路由

I r4已交接停写。FR001网络功能当前仅保存proxyMode/manualProxyRef待重启，实际Provider/MCP后台不读配置，是V1实质缺口。授权I主目录新增 `src/security/network-route.mjs`、`src/security/proxy-transport.mjs`、`tests/integration/network-settings.test.mjs`及本域部署说明；不改H provider-egress、E MCP、C system service或Lead公共入口。先设计factory精确依赖返回Lead，再实现实际传输与本地证据。

读取FR001/ADR0007/System唯一投影。启动从已存System snapshot解析off/system/manual；manualProxyRef通过SecretService受控resolve，system取明确平台/宿主配置（无配置就实际direct并说明），禁止普通环境明文持久凭据。HTTPS目标必须由共享egress先DNS校验与IP pinning，HTTP CONNECT代理不允许代理替客户端解析任意目标绕过SSRF，TLS SNI验证目标，redirect拒绝。代理凭据不出日志/context。

配置变更保存待重启；重启后由该runtime报告真实生效effectiveRoute/affectedServices，不将保存值即时冒充生效。给C/Lead同步activation callback方案，事务/失败路由保持旧真实状态。Provider模型拉取/任务、MCP HTTP统一使用同factory返回的传输，不建第二套策略。

真实本地CONNECT proxy+TLS受控CA测试：off/direct与manual走代理计数、禁私网/重定向/TLS错误拒、变更未重启旧路由、重启新路由。15181–89专属端口，临时资源隔离，禁止真实Provider。无新业务审批，普通技术选择自主，无法实现的部分如实返Lead不得恒failclosed冒完成。报告.herdr/V1-NETWORK-r5.md停写。
