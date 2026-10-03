# V1-PACKAGES r2 controlled integration

- `status`: transferred; awaiting Lead entry wiring and full regression.
- `work_package`: V1-PACKAGES/r2.
- `source`: `/Users/apple/Progame/DGOS/.worktrees/v1-packages` frozen r1 files.
- `target`: `/Users/apple/Progame/DGOS`.

## Transfer evidence

Before transfer, `git status --short -- <10 authorized paths>` returned no changes in the main workspace. Nine targets were absent; `src/apps/manifest-validator.mjs` matched the prior main baseline. Applied only these authorized paths using `apply_patch`:

- `src/apps/manifest-validator.mjs`
- `src/apps/package-service.mjs`, `package-repository.mjs`, `postgres-package-repository.mjs`
- `apps/api/src/package-routes.mjs`
- `migrations/0028-app-packages.sql`, `0029-app-package-deployments.sql`, `0030-app-package-operations.sql`
- `tests/unit/app-packages.test.mjs`, `tests/integration/postgres-app-packages.test.mjs`

`shasum -a 256` matched frozen source and main target for all 10 files. SQL checksums are 0028 `08fae924e0e37d0999c4a43933a83177a5a0f215bac99e5368b73ab1d56b5f71`, 0029 `dcdd38cba9baee568bf1919289dfe1d20899abc9a569be380d526f87c3c4e794`, 0030 `30e68b53884c70f0af4069616b73028019ab01c4a91c3cdcf9950bd94e19e4d6`.

`node --check` on all seven transferred `.mjs` files: exit 0. `git diff --check` on the authorized set: exit 0. No DB command or test execution in r2. `tests/unit/runtime.test.mjs` remained unmodified in the main workspace.

## Fixture patch for Lead/A

Main `tests/unit/runtime.test.mjs` still uses legacy manifest values. Merge these exact edits into A's current file without replacing its other changes:

```diff
-const manifest = (overrides = {}) => ({ appId: 'com.example.demo', version: '1.0.0', build: '1', releaseChannel: 'stable', minRuntimeVersion: '1.0.0', entrypoints: { web: 'index.html' }, permissions: ['settings.read'], capabilityAllowlist: ['settings.read'], trustLevel: 'official', uninstallPolicy: 'allowed', backgroundPolicy: 'none', ...overrides });
+const manifest = (overrides = {}) => ({ format: 'dgos-app/v1', appId: 'com.example.demo', version: '1.0.0', build: 1, releaseChannel: 'stable', minRuntimeVersion: '1.0.0', dataVersion: 1, name: { 'zh-CN': '示例', 'en-US': 'Example' }, entrypoints: { web: 'index.html' }, permissions: ['settings.read'], capabilityAllowlist: ['settings.read'], trustLevel: 'standard', uninstallPolicy: 'user-removable', backgroundPolicy: 'release', ...overrides });
```

In the developer test-install case, replace `manifest({ trustLevel: 'developer' })` with `manifest()`. In the health rollback case, replace only `manifest({ version: '1.0.1', build: '2' })` with `manifest({ version: '1.0.1', build: 2 })`; the later runtime lookup argument `'2'` remains a string in the old repository test.

## Lead integration and limits

Replace the existing `server.mjs` app catalog/runtime route block with `registerPackageRoutes` from `apps/api/src/package-routes.mjs`; do not register both. Pass the existing `runtimePool`, `audit`, `requireScope`, `validateCsrf`, operator-provisioned `trustRoots`, persistent private package store root, A's `onActionsChanged` callback, and a real `healthProbe`. The old route accepts manifest-only submissions and must not remain reachable. See frozen `DELIVERY-V1-PACKAGES-r1.md` for exact limitations.

Outstanding: runtime health execution/SDK handshake, data migrator, automatic startup recovery enumeration, durable Action registry binding, and transactional audit/outbox across DB and filesystem. Transferred source does not claim these complete. No commit or push made.
