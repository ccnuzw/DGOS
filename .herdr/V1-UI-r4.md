# V1-UI r4 delivery / Worker-D

- status: partial_real_acceptance; UI implementation and read-only package recovery passed; live `appPermissions` PATCH remains HTTP 500 pending Lead diagnosis.
- work_package: V1-UI r4, continued under `.herdr/v1-continuation-r5.md` and `.herdr/v1-continuation-r6.md`.
- workspace: main `/Users/apple/Progame/DGOS`; D wrote `apps/web` and this report only. No commit, push, delegation, package resigning, SQL migration, or new Task submission in the r6 closure.
- files_changed: `apps/web/src/main.tsx`, `catalog.tsx`, `protocols.tsx`, `i18n.ts`, `api.ts`, `advanced.tsx`, `hardening.tsx`, `style.css`, `index.html`, `package.json`, `tsconfig.json`, `vite.config.ts`, `scripts/serve.mjs`, `playwright.config.mjs`, `e2e/workbench.spec.mjs`, `e2e/real-workbench.spec.mjs`; prior `main.js` replaced by TSX.
- tests_added: fixture browser checks for strict System projection/PATCH, permission rule form, protocol ticket retry/expiry, package bridge input limits and old-task recovery without submit; real browser checks for System PATCH/conflict, read-only domain pages, original Task recovery via official signed package and visible host form.

## Implementation facts

- React/TS/Vite public UI, shared UI shell/tokens, dark/light and Chinese/English controls, desktop/mobile layout, first-time auth and step-up, Provider/extension/protocol/catalog/governance/assistant/task views, production `dist` static/API proxy server are in `apps/web`.
- Settings reads the top-level System projection and sends `{requestId,baseVersion,domain,patch}`. The `appPermissions` form sends the current subject's rule with `scope:{value:"*"}` and server `settingsVersion` as `baseVersion`; it does not keep an independent permission source.
- Signed app launch validates the session-bound receipt; the iframe is `sandbox="allow-scripts"`, relays only registered bridge capabilities and exact inputs, and exposes a visible old-Task recovery form using `get/events/artifact`. The original signed package envelope/root was not changed.
- Package response errors and unavailable API paths remain visible; the UI does not synthesize successful domain responses.

## Commands and evidence

- `pnpm --filter @dgos/web build`: exit 0, TS and Vite production build.
- `WEB_BASE_URL=http://127.0.0.1:15133 PORT=15133 pnpm --filter @dgos/web e2e`: exit 0, 18 fixture browser tests passed, 4 credential-gated real tests skipped.
- `git diff --check -- apps/web`: exit 0.
- `docker compose -p dgos-v1-integration -f docker-compose.integration.yml restart api`, then `curl http://127.0.0.1:15202/ready`: restart exit 0, readiness HTTP 200. This loaded G r8's receipt fix and Lead's safe 500 diagnostics; Web stayed on `15203`.
- Real Chromium on `15203`: `real API catalog, protocols, providers and existing task recovery` and `real package bridge recovers an existing task and artifact without resubmitting`: 2/2 passed. New launch instance read original Task `bf49b606-6309-49a8-a012-6dba87f0c520` as `succeeded`, returned nonempty event items and artifact text. Both iframe bridge and host recovery form displayed the existing result. Test captured capabilities and asserted no `dgos.aiTask.submit`.
- Earlier real Chromium System snapshot, appearance PATCH 200 and stale `baseVersion` conflict 409 passed before the permission step. Current real permissions test fails at the PATCH; later checks were split into the independent passing read-only test above.
- Real Chromium `PATCH /api/v1/system/settings` failed with HTTP 500 / `internal_error` after request-shape assertions passed. Latest HTTP response requestId: `1bada2a7-9608-45b1-8c74-d0559fc05327`; request body requestId: `85d8b225-ba14-4aca-b95b-d1cb301aec46`. Body fields/types: `requestId:string(UUID)`, `baseVersion:string`, `domain:"appPermissions"`, `patch.rules:array` containing `appId:"dgos.ai-workbench"`, `subjectType:"user"`, `subjectId:string(UUID)`, `capability:"dgos.model.list"`, `scope:{value:"*"}`, `decision:"allow"`. No credential or launch ticket is recorded here. A 500 does not establish whether the write committed.

## Remaining work

- Lead/C: inspect safe API exception by both request IDs, reconcile receipt/transaction outcome, repair the integrated `appPermissions` 500 and rerun the real PATCH test. C r9's dedicated PostgreSQL 14/14 does not prove the 15200 environment path.
- Real signed package update/uninstall and fresh submit were not rerun in this r6 closure. The explicit r6 task required original Task read-only recovery; no new Task was created to mask the prior `get` failure.
- Full V1 acceptance, final authority status and aggregate release gate remain with Lead/Planner/Verify.
- contract_changes_proposed: []
- open_risks: ["integrated appPermissions HTTP 500", "real package update/uninstall not exercised in this closure"]
- docs_to_update: ["Lead/Planner V1 acceptance evidence and implementation status after permissions repair"]
- decisions_needed: []

D stops r4 writes here and returns exclusive 15200 integration environment ownership to Lead.
