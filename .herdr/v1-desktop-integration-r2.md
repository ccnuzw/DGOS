# V1-DESKTOP r2 受控整合

F r1已停写，Lead允许在主目录apply_patch转入其r1 `apps/desktop`源码配置文档脚本及`packages/host-adapter/macos`源码测试（显式覆盖原worktree主目录只读）。先git状态确认无他人改动，转入核SHA。不带target/dist/fixture-web/构建制品/AGENTS/DELIVERY。如Cargo.lock属于实际依赖改动可转源码lock，不带本机路径。

Root依赖由D独占，server/worker由Lead掌握。只语法/配置检查，无需重做已通过fixture；报告 `.herdr/V1-DESKTOP-r2.md` 后停写。不提交推送。

r1原生PID/Webview请求/持久化结果可保留，辅助功能窗口像素验证失败属于限制，不升级为完整GUI业务验收；r3会接主目录真实前端dist和API。
