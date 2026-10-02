# V1-UI live management r6 / Worker-D (2026-10-02)

## Environment and asset

Main working tree; D-owned integration PG/Redis/API/Web group 15200–15204. Public Web `http://127.0.0.1:15203` and API `/ready` returned 200. Tests use the real administrator Session and public HTTP routes; credential values are supplied privately and are absent here. `apps/web/e2e/real-management.spec.mjs` SHA-256 `915fa4235b534223f14384b49e278d18e255e47ca7e6dfa365716adac63e908d`.

During r6, live `/governance` initially blanked after successful login. Browser exception was `Cannot read properties of null (reading 'version')`: the common `Data` wrapper rendered its child before the first policy fetch. After notifying Lead in the work stream, D changed only the null loading guard in `apps/web/src/hardening.tsx`. Its SHA-256 is `e386800cdf523e37b4ee7fcd169ebda0d299653eb16b509111adafa20179c004`; `pnpm --filter @dgos/web build` passed and produced `index-CFFA2HUn.js` SHA-256 `23a7a5029f5730d6bd4aeafbdf5c2470282a1e2439508428e880da66fe1b8eb5`. This is a new r6 candidate; it does not inherit the r5 candidate hash.

## Real Chromium outcomes

Command pattern: `REAL_ADMIN_ID=<redacted> REAL_ADMIN_CREDENTIAL=<redacted> WEB_EXTERNAL=1 WEB_BASE_URL=http://127.0.0.1:15203 pnpm --filter @dgos/web exec playwright test -c playwright.config.mjs e2e/real-management.spec.mjs -g '<case>' --workers=1`.

| Case | Result | Public assertion |
| --- | --- | --- |
| Device list and revoke | Pass, 1/1 | Two same-owner Sessions; page list identifies the second via `sm_` management ID; DELETE 200 revokes only it; its current-session GET becomes 401; first remains active, then ordinary page Sign out returns 204 and first becomes 401. |
| Quota subject policy | Pass, 1/1 | Page PUT 200 creates one current-subject policy and public list returns the same `policyId`, metric, 25/day limit. |
| Governance policy | Pass, 1/1 after narrow UI fix | Page PUT 200 carries prior `baseVersion`, returned version changes; `action=governance.policy.update` audit query contains the HTTP response `x-request-id`; retention preview is visible. Earlier attempt searched only 30 unfiltered events and failed despite PUT 200. |
| Custom Skill | Partial, blocked | Page POST created `ui-r6-1790909338269`, 201, `sourceType=custom`, `state=installed`. Subsequent authorized GET `/skills/{id}/definition` returns 409 `confirmation_required`, requestId `ba4b988d-f359-4109-a438-f626bf17ff48`. No rename or state change was attempted after this response. |
| Assistant candidate | Blocked | Page POST `/actions/resolve` for `open settings` returns 500 `internal_error`, requestId `4080e327-809d-4d08-865d-a1ec8e90445f`; no plan/execute was sent. Safe API log gives PostgreSQL code 23502 at `PostgresAuditRepository.insert`, called from `permissions.check` during `resolveNaturalLanguageCandidates`. A/Lead owns service repair. |

The first Skill attempt used a stale button label and made no request. A later run created the single Skill above; the test now supports `REAL_SKILL_ID` to resume it without another create. The initial device test omitted the page Refresh and made no revoke request. These test locator/setup failures are historical attempts, not API failures.

## Checks and remaining work

`pnpm --filter @dgos/web check`, targeted local UI-AC003 and Settings fixture tests (2/2), `node --check apps/web/e2e/real-management.spec.mjs`, and `git diff --check` passed. Full local `WEB_BASE_URL=http://127.0.0.1:15133 pnpm --filter @dgos/web exec playwright test -c playwright.config.mjs --workers=1` passed 30/30 fixture cases with 10 real-environment cases correctly skipped. The previous r5 real parameter Task remains one submitted Task; r6 did not submit another.

MCP template install/config/connect/tools/invoke and Skill translation Task/Artifact/apply still require a Lead-coordinated trusted runtime/fixture. Assistant high-risk permission, denial/cancel and durable Run/audit paths wait for the resolver 500 repair. Existing r6 tests do not substitute for those real browser paths. Skill name edit/disable waits for the definition GET 409 repair or final E service reload. No server restart, database mutation outside public UI, signing, commit or push was performed by D.

`status`: partial real acceptance, blocked cases above; UI source r6 narrow fix built. `work_package`: `.herdr/v1-ui-live-management-r6.md`. `files_changed`: new real management browser test, one-line UI loading fix, this report and paired manifest. `tests_added`: five real management cases. `commands_run`: exact command pattern and individual results above; build/check/targeted local tests/diff check passed. `implementation_facts`: live device, quota and governance paths above. `contract_changes_proposed`: []. `open_risks`: current Skill 409, resolver 500, controlled MCP/translation runtime absent, complete r6 fixture rerun pending. `docs_to_update`: Lead/Planner should map only the passed cases into the acceptance matrix. `unfinished`: Skill edit/disable, assistant permission/Run branches, MCP and translation live browser paths. `lead_or_planner_decisions_needed`: coordinate E final reload and trusted runtime setup; A/Lead to repair resolver audit failure.
