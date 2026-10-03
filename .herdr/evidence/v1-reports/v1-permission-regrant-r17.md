# V1-PERMISSION-REGRANT r17 — Worker-C handoff

status: narrow_fix_delivered; memory_and_isolated_pg_passed; D15200_retest_pending
work_package: V1-PERMISSION-REGRANT r17 / Worker-C / Codex; V1-FR-001 rule 8, main flow 6, AC07; frozen D025 and runtime contract section 4.3; Planner `.herdr/V1-STATUS-RECONCILE-r8.md` section 6.4
workspace: `/Users/apple/Progame/DGOS` (shared main tree, assigned paths only)

files_changed: [`src/system/permission-rules.mjs`, `src/permissions/postgres-repository.mjs`, `tests/integration/system-permission-rules.test.mjs`, `.herdr/V1-PERMISSION-REGRANT-r17.md`]
tests_added: [memory and PostgreSQL System regrant cases in the existing integration file; replaced the incorrect PostgreSQL deny-to-allow irreversible assertion with successful same-key management and replay]
commands_run: [
  `env -u DGOS_DATABASE_URL node --test tests/integration/system-permission-rules.test.mjs tests/integration/permission-action-lifecycle.test.mjs` exited 0: 7 passed, 0 failed, 6 dedicated-DB cases correctly skipped;
  `node --input-type=module -e '<random strict Verify child, frozen migrations, node --test --test-concurrency=1 two assigned integration files, drop child>'` exited 0: selected/applied 47 migrations with ordered set SHA-256 `0cb6df60c0bbd5527bc6c8f1314be67fed7dbe6de7f1de30bb8681771af2744d`, 13 passed, 0 failed, 0 skipped; child `dgos_v1_verify_962ea07cd7eab5f901297cd6523b8975` dropped and catalog remaining count 0;
  `node --check` on both changed source files and integration file exited 0;
  `git diff --check --` three changed source/test paths exited 0;
  `shasum -a 256` of the three changed source/test files exited 0
]

implementation_facts: [System `appPermissions` management now permits an authenticated, fresh, same-subject, declared, version-matched explicit edit of one owned rule from deny to allow in both memory and PostgreSQL; the PG System batch no longer enables historical deny precedence in `writeDecision`, while PG pending `resolveRequest` still enables it, so old ask approval cannot overwrite a later deny; current deny still blocks broker execution until a successful explicit edit; System settings/context version and context event advance once with permission and system audit/outbox, and exact request replay does not write again; missing `system.settings.write` or `permission.manage`, stale Session, stale baseVersion, cross-subject, undeclared capability and audit failure leave the denied rule unchanged; the existing public route's CSRF behavior was not modified]
contract_changes_proposed: []
open_risks: [no D15200 mutation/reload or real Settings browser recovery was performed; Lead owns `server.mjs` legacy permission PATCH follow-up and D's same-source UI retest; this local scoped result is not full V1 acceptance]
docs_to_update: [Lead/Planner may attach this bounded r17 result to FR001 AC07 and the permission recovery gap after independent integration, keeping the real browser result separate]
unfinished_items: [Lead/D controlled reload and direct deny-to-allow Settings UI plus original Skill read retest; current candidate regression and source freeze]
lead_or_planner_decisions_needed: []

Current SHA-256: `src/system/permission-rules.mjs` `34ea7a5b5419e7a51c3a0a0416c2652e3bde0847876088d16f5d8aef9181fc1d`; `src/permissions/postgres-repository.mjs` `25c4445e830d35b02ff7632e0ee0424831f282451b348ac3a4f684ca554a7037`; `tests/integration/system-permission-rules.test.mjs` `f2756fff0f8ab28ef254576bf5441d3ec1cda82deca49cadbac9f00ccbf5de81`.

No `server.mjs`, D15200, migration, public schema, broker default, commit or push changed. Worker-C stops writing after this report.
