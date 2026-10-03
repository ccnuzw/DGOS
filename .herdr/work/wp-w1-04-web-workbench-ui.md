status: completed
work_package: WP-W1-04
owner: worker-web
revision: working-tree

scope:
  - apps/web/src/api.ts
  - apps/web/src/main.tsx
  - apps/web/e2e/workbench.spec.mjs

implementation_facts:
  - AI Workbench now submits dgos.aiTask-compatible text requests with requestId, target, intent and text options.
  - Existing task snapshot/SSE cursor recovery, cancellation and artifact links remain available.
  - Explicit mock mode uses `?mock=1` or `VITE_DGOS_MOCK=1`; it simulates queued/running/succeeded, text.delta events and an artifact reference in memory.
  - Event count and cursor are visible during task recovery.

commands_run:
  - command: pnpm --filter @dgos/web check
    result: passed
  - command: pnpm --filter @dgos/web build
    result: passed
  - command: WEB_EXTERNAL=1 WEB_BASE_URL=http://127.0.0.1:15133 pnpm --filter @dgos/web exec playwright test -c playwright.config.mjs e2e/workbench.spec.mjs --grep='task route restores|mock workbench submits'
    result: passed (2 tests)
  - command: git diff --check -- apps/web/src/api.ts apps/web/src/main.tsx apps/web/e2e/workbench.spec.mjs apps/web/src/i18n.ts
    result: passed

limitations:
  - Real provider/task endpoint remains the default path and requires Worker-AI API availability for live integration.
  - Full Web E2E suite was not used as acceptance evidence because unrelated existing real-backend and system-info tests fail when their services are unavailable.
