# w3-20261003180215-87906

- Result: FAIL
- Code version: `f14a3c9827bd8a9948a5f30f97a546388936b082`
- Source drift: true

| Group | Command | Result | Exit |
| --- | --- | --- | ---: |
| web | `pnpm exec playwright test apps/web/e2e/real-management-fixture.spec.mjs --config=apps/web/playwright.config.mjs --reporter=line` | failed | 1 |
| web | `pnpm exec playwright test apps/web/e2e/w2-03-web-e2e.spec.mjs --config=apps/web/playwright.config.mjs --reporter=line` | passed | 0 |
| fr002 | `node --test --test-concurrency=1 tests/integration/app-package-fixture.test.mjs tests/unit/app-packages.test.mjs tests/unit/runtime.test.mjs` | passed | 0 |
| fr002 | `node --test --test-concurrency=1 tests/integration/ai-task-api.test.mjs tests/integration/provider-worker.test.mjs tests/provider/profile-task-wiring.test.mjs` | passed | 0 |
| native | `pnpm --filter @dgos/desktop check` | passed | 0 |
| native | `node apps/desktop/scripts/e2e-macos.mjs` | passed | 0 |

## Limitations
- Web fixture uses deterministic local Provider upstream; it is not external Provider evidence.
- Native smoke proves process/window/webview bridge/keychain session only; it does not assert Provider/Task/Artifact.
- Historical reports and prior builds are not included in this manifest.
- A failing command remains evidence and cannot be promoted to PASS.
