# V1-EXT-READ r9 — Worker-E / 2026-10-02

## Diagnosis and retest handoff

D's `.herdr/V1-UI-r6.md` records POST `/api/v1/skills/custom` 201 for `ui-r6-1790909338269`, followed by GET `/api/v1/skills/{skillId}/definition` 409 `confirmation_required`, requestId `ba4b988d-f359-4109-a438-f626bf17ff48`. The frozen management OpenAPI requires `skill.read` and current ownership for this private definition read. `ExtensionManagementService.createCustom` checks `skill.install`; `definition` separately checks `skill.read`. `ExtensionService.authorize` maps an undecided `ask` to 409. This is the observed contract behavior when the principal has no explicit `skill.read` decision, not evidence of a stale runtime or a product read defect. The D environment's actual decision row was not inspected; its 15200 services/database were untouched.

D can use its existing `REAL_SKILL_ID=ui-r6-1790909338269` branch. In the same authenticated subject, set `appPermissions` via the authorized Settings flow to `appId=dgos.extensions`, `capability=skill.read`, `scope=*`, `decision=allow`; set `skill.manage=allow` for the subsequent edit. The current D browser test already calls `setPermission` for both in the `REAL_SKILL_ID` branch. If a 409 persists after the Settings receipt confirms the rule, inspect that subject's effective `skill.read` decision and API log for the new requestId before any code change. The create-new branch should also grant `skill.read` before its definition read. The UI should display the permission-required state and let the user resolve it through Settings/permission request, rather than silently grant access. A `deny` decision remains 403. No implicit allow was added.

## Verification

Added a focused public Fastify route + real PostgreSQL permission broker/audit case in `tests/extensions/management-routes-pg.test.mjs`. The sequence creates a custom Skill with explicit `skill.install=allow`, receives 409 and no private Prompt before `skill.read` grant, receives 200 with `Cache-Control: no-store` and the Prompt after `allow`, then receives 403 and no Prompt after `deny`. PostgreSQL audit confirms the ordered permission checks and only one successful `extension.skill.definition.read` event. This isolated Fastify instance has no shared API error wrapper, so assertions use its native `message`; D's full API response uses `errorKey`.

Commands run in `/Users/apple/Progame/DGOS`:

- `DGOS_EXTENSION_TEST_DATABASE_URL=postgresql://dgos:dgos@127.0.0.1:5432/dgos_v1_extensions_r3final node --test tests/extensions/management-routes-pg.test.mjs` — 2/2 pass after correcting the isolated response assertion. Initial run reached 409 but failed on the test-only `errorKey` field assumption.
- `node --check tests/extensions/management-routes-pg.test.mjs` — pass.
- `git diff --check -- tests/extensions/management-routes-pg.test.mjs` — pass.
- `shasum -a 256 apps/extension-runner/src/mcp-transport.mjs` — `73dae1558ac3b1e55f8ece4a9de4efc1d823f0966529ed514e7236ef7f26131a`, unchanged.

Test SHA-256: `793dcfdb8c200b186e0f5bc1262679a43fa9ae6a9bf2c8710941d2b88749b1f1`.

## Worker receipt

- `status`: r9 diagnosis complete; public PG regression passes; no product source change.
- `work_package`: `.herdr/v1-convergence-r16.md` E / V1-EXT-READ r9.
- `files_changed`: `tests/extensions/management-routes-pg.test.mjs`, this report.
- `tests_added`: real PG custom Skill create/read allow/deny route sequence with audit and private Prompt boundary.
- `commands_run`: listed above.
- `implementation_facts`: create checks `skill.install`; private definition GET checks `skill.read` and owner; undecided permission produces 409; allowed read is no-store and audited; denied read produces 403.
- `contract_changes_proposed`: [].
- `open_risks`: D's specific permission row and full browser retest remain unverified; a persistent 409 after an allow decision would require its new requestId and subject-scoped decision evidence.
- `docs_to_update`: Lead/Planner can attach this diagnosis and the eventual D real-browser result to V1-FR-003 acceptance evidence; no authority change proposed.
- `unfinished`: D real-browser retest on 15200 environment.
- `lead_or_planner_decisions_needed`: [].
