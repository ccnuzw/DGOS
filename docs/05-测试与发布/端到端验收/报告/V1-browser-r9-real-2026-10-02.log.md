# V1 browser r9 real run log

Command:

```sh
REAL_MANAGEMENT_FIXTURE=1 WEB_EXTERNAL=1 WEB_BASE_URL=http://127.0.0.1:15176 pnpm --filter @dgos/web exec playwright test -c playwright.config.mjs e2e/real-context.spec.mjs e2e/real-management-fixture.spec.mjs --workers=1 --output=../../.herdr/state/browser-r9-fresh
```

Observed UTC: 2026-10-02 (exact invocation start timestamp was not captured).

```text
Running 5 tests using 1 worker
{"case_passed":"ui.system.appearance_context"}
{"case_passed":"ui.system.locale_context"}
{"case_passed":"ui.system.grid_context"}
{"case_passed":"ui.system.cas_conflict"}
{"case_passed":"ui.system.restore"}
PASS real System appearance, locale, grid, CAS and restoration use public API
{"case_passed":"ui.skill.translation_apply"}
{"case_passed":"ui.skill.translation_stale_rejected"}
PASS real Skill translation reaches Task, Artifact and confirmed apply
{"case_passed":"ui.mcp.first_install"}
PASS real MCP first credential install requires an absent target
{"case_passed":"ui.mcp.connect_invoke"}
PASS real installed MCP connects, discovers tools and invokes a confirmed Run
{"case_passed":"ui.assistant.ask_request"}
{"case_passed":"ui.assistant.allow_replan_navigation"}
PASS real assistant request needs System approval, then its run opens Settings
5 passed (6.5s)
```

This log transcribes the Lead terminal output from the successful run. Playwright's configured output directory retained only `.last-run.json` (`status=passed`, `failedTests=[]`); it did not retain a console log. The fixture database is a fresh random child and contains private credentials outside this report. The run exercised Web/API/PostgreSQL/Redis/worker and the controlled local TLS Provider/MCP fixture, not a signed macOS APP or external Provider.
