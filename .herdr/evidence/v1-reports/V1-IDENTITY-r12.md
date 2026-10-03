# V1-IDENTITY r12 — Worker-C delivery

- status: domain_delivered; local two-instance HTTP/PG/Redis verification passed; Lead/Verify integration acceptance pending
- work_package: V1-IDENTITY-MULTIINSTANCE r12, V1-FR-010 AC01–04, V1-FR-011 AC01–04
- workspace: `/Users/apple/Progame/DGOS`, baseline `72ab1cb`, shared main directory with assigned identity paths only
- files_changed: `apps/api/src/identity-service.mjs`, `src/identity/repository.mjs`, `apps/api/src/identity-routes.mjs`, `migrations/0050-session-management.sql`, `scripts/v1-identity-http.mjs`, `tests/security/v1-governance-e2e.test.mjs`, this report and paired evidence assets. Lead alone changed `apps/api/src/server.mjs` registration.
- tests_added: `scripts/v1-identity-http.mjs` (20 named live cases); existing V1-E2E-11 changed to frozen singular logout semantics.

## Commands and evidence

- `pwd` → `/Users/apple/Progame/DGOS`; `git rev-parse --short HEAD` → `72ab1cb`.
- `node --check scripts/v1-identity-http.mjs`, `node --check apps/api/src/identity-routes.mjs`, `node --check apps/api/src/identity-service.mjs`, `node --check src/identity/repository.mjs` → exit 0 each.
- `node --test tests/integration/identity-api.test.mjs tests/security/key-delegation.test.mjs tests/security/v1-governance-e2e.test.mjs tests/integration/action-freshness.test.mjs` → exit 0, 8 pass, 1 skip (Actions PG test requires its separately assigned `dgos_v1_actions` parent). No claim of that skipped test passing.
- `set -o pipefail; node scripts/v1-identity-http.mjs 2>&1 | tee .herdr/evidence/V1-IDENTITY-r12-live.log` → exit 0, 20/20 named cases pass. Full redacted output: [live log](evidence/V1-IDENTITY-r12-live.log); source before/after SHA-256, all cases, exits and cleanup: [manifest](evidence/V1-IDENTITY-r12-manifest.json). Log SHA-256 `56159e7e0c229034f0d0896ad73d940888a88e95367dc1d90b0a8fbe555a22b7`; manifest SHA-256 `714ba199cb55b5efd9d6088a2542266230a5027cee4c6c1de28b26c18f279286`.
- `git diff --check -- apps/api/src/identity-service.mjs src/identity/repository.mjs tests/security/v1-governance-e2e.test.mjs` → exit 0. `rg` secret-pattern scan of evidence log/manifest found no bearer or API Key value; only the intentionally named random child database matched the broad `dgos_` prefix.
- Frozen migration [0050-session-management.sql](../migrations/0050-session-management.sql) SHA-256 `8802fe3a02b0bf7364aeac96215da09454d0c53b48c06d2cb76c6f3d6b455d85`. Applied only to the random r12 child database. Migration window was versions `<=0046` plus frozen `0048-network-route-fingerprint` and `0050-session-management`; unfinished 0047 and draft 0049 were excluded.

## Implementation facts

- Two independently constructed/listening `buildServer` instances at 15121/15122 shared a random `dgos_v1_identity_<hex>` PostgreSQL child and Redis DB3 unique `v1-gov-r12:<run>` prefix. Bootstrap race produced one principal/session/audit and cleaned loser Secret. Login failures shared source and subject backoff; unknown subject and wrong credential gave the same public `invalid_credentials` result without a session.
- 0050 adds a stable random `sm_` management reference to each Session and a per-principal/requestId revoke receipt. Management references cannot authenticate and bearer session IDs cannot target management DELETE. GET sessions is same-subject Session-only, no-store, read-audited, paginated by database timestamp plus management ID, with unknown device hints instead of invented labels. No bearer or private network detail is projected.
- Managed DELETE checks current Session freshness and CSRF, looks up target by management ID plus principal inside a transaction, and commits revoke, audit/outbox and receipt together. Cross-owner gives 404 with no target/audit side effect; repeated requestId yields the same redacted receipt and one audit; audit failure rolls back. Other devices stay active. Single-session DELETE allows stale but active self logout and clears Cookie. Expired Session cannot renew; revoke/renew race ends revoked across instances.
- API Key was authenticated cross-instance with constrained scopes; old and new Keys worked during a finite overlap, then old Key failed; expiry and explicit revoke failed closed. Audit storage scan contained no login credential or Key secret. Stale Session was rejected by live PG HTTP for System privacy PATCH and high-risk Action execution, with System version unchanged; separate memory Action test also passed.
- Script `finally` verified random child database dropped, Redis prefix empty, and temporary package directory absent. It did not touch default `dgos`, Redis DB0, D port 15200, or Provider production traffic.

## Contract changes proposed / wired

- Lead registered `registerIdentityRoutes(app, { identity, currentSession, validateCsrf, requireFreshSession, receiptCookie, authenticationBackoff, loginLimiter, maxLoginAttempts, loginWindowMs })` once in `server.mjs`, replacing the old inline identity routes. Domain constructor remains `new IdentityService({ repository, secretService, clock })`; PG repository remains `new PostgresIdentityRepository(pool)`.
- `GET /api/v1/identity/admin/sessions` returns only `AdminSessionList`; `DELETE /api/v1/identity/admin/sessions/{sessionId}` accepts only `sm_` management ID with requestId; `DELETE /api/v1/identity/admin/session` is current-session logout. The legacy bearer-valued management path is intentionally rejected. D/F should use `sessionManagementId` for device controls and the singular path for logout.
- 0050 must be applied before booting code that inserts/reads `session_management_id`. Keep its SQL byte-identical after this checksum handoff; any further schema change needs another migration.

## Failed intermediate batches and limits

- First `node scripts/v1-identity-http.mjs` exited 1 at startup, PostgreSQL `42703` because the initial selected migration set omitted frozen 0048's `route_fingerprint` column used by current System. No identity assertion ran. Corrected the isolated migration selection.
- A subsequent script attempt exited 1 with JavaScript `SyntaxError` from `await` inside a synchronous predicate; no database was created. Corrected before the successful final batches. Earlier pre-registration runs reported public device revoke 403 under old inline route; after Lead registration those same checks passed and the bypass path was removed from the script.
- Evidence is local isolated PG/Redis with `RedisSecretService` test backend, not production Secret durability or a release/production gate. One real administrator created three sessions; no invented second active administrator. Cross-owner target masking was checked at the PG domain boundary using a different actor ID because the frozen deployment model did not provide a second administrator. Real device labels and UI/browser behavior remain D/F evidence. The Action PG test requiring the separately owned Actions parent was skipped; live r12 child did exercise Action/System stale HTTP gates.
- open_risks: public environment/release gate, UI device management and actual device label evidence, production Secret backend integration, broader role/administrator provisioning outside this package.
- docs_to_update: Planner/Lead attach this batch to FR-010 AC01–04, FR-011 AC01–04 and implementation status; replace planned OpenAPI implementation tags only after integrated verification. Do not promote this worker report alone to V1 completion.
- unfinished_items: no r12 domain code task remaining; integration acceptance and UI/browser evidence remain with Lead/D/F/Verify.
- lead_or_planner_decisions_needed: none for the frozen r12 behavior; Lead owns integrated acceptance and any later scope expansion.

Stopped writing after this handoff. No commit, push, service/database mutation outside the isolated r12 child, or delegation.
