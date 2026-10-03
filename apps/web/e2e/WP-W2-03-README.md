# WP-W2-03 Web E2E

测试文件：`w2-03-web-e2e.spec.mjs`；数据和断言 helper：`w2-03-fixture.mjs`。

先行检查：

```sh
node --check apps/web/e2e/w2-03-fixture.mjs
node --check apps/web/e2e/w2-03-web-e2e.spec.mjs
pnpm exec playwright test apps/web/e2e/w2-03-web-e2e.spec.mjs --config=apps/web/playwright.config.mjs --list
```

真实批次：

```sh
W2_E2E=1 \
REAL_ADMIN_ID="..." \
REAL_ADMIN_CREDENTIAL="..." \
W2_PROVIDER_CONFIG_ID="ready-provider-config-id" \
WEB_EXTERNAL=1 WEB_BASE_URL="http://127.0.0.1:15133" \
pnpm exec playwright test apps/web/e2e/w2-03-web-e2e.spec.mjs --config=apps/web/playwright.config.mjs
```

测试直接调用 DGOS API，真实被测边界包括 Web session、API、Worker、PG、Redis、Task/SSE/Artifact。推荐传入 W2-01 创建并置为 ready 的 `W2_PROVIDER_CONFIG_ID`；未传入时测试会尝试创建 account/config，但 ready account、上游 probe 和 model policy 仍需由 Worker-AI fixture/环境提供。`w2-03-fixture.mjs` 的 Provider 地址/凭据只是上游 fixture 输入；它不拦截或 mock DGOS API，不得把 fixture 结果写成真实外部 Provider 证据。

覆盖：

- 登录、Provider account/config、模型刷新、Task、SSE、Artifact 和秘密不泄露。
- 相同 `requestId` 重复提交返回相同 `taskId`。
- SSE cursor 恢复只返回更高 sequence；取消后只接受终态。
- 未知 Provider config 返回明确错误且无 artifact 副作用。

Provider 上游失败、网络断开和未知提交必须由真实 fixture/Worker-AI 入口提供后再加到独立批次；当前测试不会把未执行分支标记为通过。
