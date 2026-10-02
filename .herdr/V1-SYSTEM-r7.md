# V1-SYSTEM r7 / Worker-C

- status: partial_delivered; System projection ready for Lead wiring, `appPermissions` remains blocked on a transactional Permission adapter
- work_package: V1-SYSTEM r7; V1-FR-001
- workspace: `/Users/apple/Progame/DGOS`; baseline `72ab1cb`, shared dirty tree
- files_changed: `src/system/service.mjs`, `src/system/repository.mjs`, `apps/api/src/system-routes.mjs`, `migrations/0044-system-projection.sql`, `tests/integration/system-http-projection.test.mjs`, `tests/integration/system-cross-process.test.mjs`, System assertions only in `tests/integration/runtime-api.test.mjs`, this report
- tests_added: HTTP projection, old-shape rejection, locale separation, bounded scale/grid, network pending restart, SSE cursor, context authorization, sensitive legacy JSON redaction, requestId replay, cross-process PG audit/outbox and migration upgrade

## Lead and D interface

Replace the four inline System routes in `apps/api/src/server.mjs` with:

```js
registerSystemRoutes(app, {
  system,
  readAuth: appAuth,
  writeAuth: runtimeWrite,
  permissionRules,
});
```

`readAuth/writeAuth` must enforce the requested scope; `writeAuth` must retain CSRF. The route requests `system.settings.read`, `system.settings.write`, `dgos.system.context.read`, and `dgos.system.context.events`. The latter two scopes currently need Lead authorization mapping before exposing context to API keys or apps. Control-plane context is explicitly `appId: 'dgos.system'`, `windowState: {kind:'none'}`, `lifecycleState:'headless'`; it does not claim arbitrary APP installation or a live window.

Public PATCH is exactly `{requestId,baseVersion,domain,patch}`. GET/PATCH success is top-level `settingsVersion,appearance,locale,network,grid,privacy,restartRequired,affectedServices`, and `appPermissions` only when a real `permissionRules.list` is injected. No parallel `settings` wrapper is returned. `appearance.appearanceMode` is `system|light|dark`; `displayScale` is one of `0.75,1,1.25,1.5,1.75`; `locale` includes independent `uiLocale,effectiveLocale,regionFormat,assistantLanguage,projectContentLanguage`; grid has the OpenAPI required fields with bounds. Network accepts only `proxyMode,manualProxyRef`; pending restart retains the old `effectiveRoute`. Context returns top-level `contextVersion,appId,appearance,locale,networkSummary,grid,windowState,lifecycleState,issuedAt`. Events are `text/event-stream`, `id` equals `contextVersion`, with `Last-Event-ID` or `afterVersion` cursor.

Internal Action callers keep `system.patch({baseVersion,patch:{domain,value},actorId,requestId})`; legacy `mode/language` converts internally. Public route rejects that old nested request. Request receipts persist in the same settings JSON row as the version, event, audit event and outbox transaction. A retry from another service instance returns the original result and does not write a second audit event.

## `appPermissions` dependency

Existing `PermissionBroker.decide` writes one rule with its own audit transaction, but it lacks a subject-wide list and an atomic batch operation coupled to the System settings/context version. System JSON is not the authoritative permission store. The route accepts an injected adapter:

- `permissionRules.list({subjectId}) -> PermissionRule[]` from the authoritative broker store.
- `permissionRules.patch({subjectId,actorId,requestId,baseVersion,rules,fingerprint,system}) -> {snapshot,rules}`; implementation must validate installed app/declarations, deny precedence and scope, then commit rule changes, System version/context event, idempotent receipt and audit/outbox as one transaction. It must reject stale versions without side effects and return the committed snapshot.

Without both methods, `appPermissions` is omitted from GET/PATCH projections and its PATCH returns 503 `permission_unavailable`; this is a deliberate fail-closed incomplete path, not FR-001 completion. Lead should assign the Permission repository adapter to its owner and inject it with server wiring. The HTTP delegation and cross-subject rejection are covered only by a mock adapter test; no real Permission transaction is claimed.

## Migration and test evidence

- `0044-system-projection.sql` persisted initialized required fields, converts old `appearance.mode` and `locale.language`, recalculates `effectiveLocale`, strips old network credential fields and preserves versions. If old network mode lacks a proven effective route, it uses `unavailable` with `restartRequired=true`. Applied **only** to `dgos_v1_governance`; final SQL SHA-256/checksum `a95019d20a3d2e63678b23f14fb35929f65c0192b075b4d995d35c8fb067e647`. A temporary-table migration test proved old versions 7/9 stay 7/9. Do not modify 0044 after this application; use a new migration number for future changes.
- `DGOS_DATABASE_URL=postgresql://dgos:dgos@127.0.0.1:5432/dgos_v1_governance node --test tests/integration/system-http-projection.test.mjs tests/integration/system-cross-process.test.mjs` -> 10 passed, 0 failed, 0 skipped. Includes two independent SystemService instances and one audit/outbox event on replay.
- `git diff --check -- src/system apps/api/src/system-routes.mjs migrations/0044-system-projection.sql tests/integration/system-http-projection.test.mjs tests/integration/system-cross-process.test.mjs tests/integration/runtime-api.test.mjs` -> exit 0.
- SHA-256: service `7f45e34addbd30af8a6aad9decdbc0b6274bb1efff44567aa244a1d9ee4f9276`; repository `f80c403768a7e18b250385302f9303952f6233263da0c76f6491a117344107ae`; route `c2084b9cf0cf87875f23db4ef788edeb6e454cf9cb13d969884cec791e6dd959`; HTTP test `f7977462bd979a7fc9dc23c693cb153b871c666e858a3d00d92eaf191a7ba335`; cross-process test `aa6c4be9f1b4928e70ef93e65f5f984edf1d657b3478e6be9aad62347d2c3ad0`; runtime API test `44ba2312b64d7465149770300288366f1c327fdd86ee6e1c86dfd853db81066a`.

## Limits and next integration gate

- Lead has not replaced the four inline server routes yet. `tests/integration/runtime-api.test.mjs` now expects the new public shape and must be run after Lead wiring. No public server pass is claimed here.
- The context is bound only to the control plane. Per-app instance/window context requires real package/runtime binding and should not be inferred from client `appId` input.
- Network proxy persistence does not activate a proxy; pending restart reports the old route. `effectiveRoute='unavailable'` is used where the old route cannot be proven.
- Settings read/context read audit obligations in FR-001 were not added in this package; Lead should resolve read-audit ownership at public entry. Settings mutation audit/outbox is transactional and tested.
- docs_to_update: FR-001 implementation evidence and V1 status after Lead route wiring, Permission adapter, public runtime regression and UI/desktop E2E.
- unfinished_items: transactional Permission adapter and Lead server wiring; public runtime API regression and full V1-E2E-10.
- Lead_or_Planner_decisions_needed: assign Permission adapter owner and clarify public context scope mapping, read-audit ownership, and per-app instance binding.

No commit, push, delegate, integrated DB, or other domain writes. Worker-C stops System writes after this handoff.
