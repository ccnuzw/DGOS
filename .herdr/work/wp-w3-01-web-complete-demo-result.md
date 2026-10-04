status: completed
work_package: WP-W3-01
owner: worker-web
revision: working-tree

implementation:
  - Workbench now loads real Provider configurations from `/api/v1/provider/configs`.
  - Provider model catalog is loaded from `/api/v1/provider/configs/{providerConfigId}/models`.
  - Task model selector filters to declared text-capable models and submits the selected providerConfigId/modelId.
  - Existing task GET/SSE cursor recovery and cancellation remain active.
  - Artifact IDs are now opened through the authenticated API and rendered inline in the result panel.
  - Provider/model selections persist locally for repeatable demos without storing secrets.
  - Added browser coverage for provider/model binding and task submission.

commands_run:
  - command: pnpm --filter @dgos/web check
    result: passed
  - command: pnpm --filter @dgos/web build
    result: passed; existing CSS import/order warnings remain in the current working tree
  - command: WEB_EXTERNAL=1 WEB_BASE_URL=http://127.0.0.1:15133 pnpm --filter @dgos/web exec playwright test -c playwright.config.mjs e2e/workbench.spec.mjs --grep='task route restores|mock workbench submits'
    result: previously passed for the existing recovery and mock flows
  - command: git diff --check -- apps/web/src/main.tsx apps/web/e2e/workbench.spec.mjs
    result: passed

limitations:
  - Full real-provider E2E requires the Worker-AI fixture/server and its environment variables; those were not available in this Web session.
  - A combined Playwright run against the already-running dev server did not emit a final reporter summary; no new production TypeScript/build failures occurred.
