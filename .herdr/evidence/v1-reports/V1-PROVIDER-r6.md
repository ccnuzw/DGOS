# V1-PROVIDER HTTP r6 delivery

status: delivered
work_package: V1-PROVIDER r6
date: 2026-10-02
workspace: /Users/apple/Progame/DGOS (main, explicit r6 authorization)

## Scope and files

- Added `scripts/v1-provider-http.mjs`. It creates a random `dgos_v1_provider_<hex32>` PostgreSQL child database, applies frozen migrations through 0048 plus 0050 while excluding 0049/0051, starts real public HTTP and a controlled HTTPS Provider fixture, and runs the real PostgreSQL worker in a separate Node OS process. Redis uses DB5 with a unique `v1-provider-r6:<hex>` secret prefix. Public HTTP creates the admin session, publishes and confirms two Profiles, creates the account/configs, runs connection validation, refreshes catalog, enables policy, sets quota, and submits Tasks. Direct SQL is used for migration/observation, fault lease expiry, and isolated database cleanup.
- No product source or frozen migration was changed in r6. r5's PG test remains correctly described as reconstruction in one OS process; this r6 run establishes a distinct worker PID and a second PID after restart.
- Paired append-only evidence: `tests/provider/evidence/V1-PROVIDER-r6-2026-10-02T01-37-05-899Z-13a59b2f.json`, `.log`, and `-manifest.json` at the same stem. The manifest hashes the exact report/log bytes and source assets.

## Final command and result

- `node --check scripts/v1-provider-http.mjs`: exit 0.
- `node scripts/v1-provider-http.mjs`: exit 0; 9 passed, 0 failed. Parent PID 37808; observed worker PIDs 37825, 37836 after graceful restart, and 37840 after SIGKILL. The report records all PIDs, task IDs, snapshot digests, migration versions, and cases without credentials or request bodies.
- `git diff --check`: exit 0. Manifest `sourceBefore` equals `sourceAfter`; report/log SHA-256 values match the manifest. PostgreSQL query after completion found zero `dgos_v1_provider_<hex32>` child databases.
- The earlier 8-case pass preceded two added assertions. An intervening attempt failed because the script's SIGKILL callback referenced a cleared worker variable; that script defect was fixed, its one random child database was removed after checking no sessions remained, and the final 9-case run above is authoritative. No product defect was found.

## Verified cases

1. Isolated child database applied the frozen migration allowlist; 0047, 0048, and 0050 checksums matched the allocation board. 0049 and 0051 were excluded.
2. Public API and independent worker process started with different PIDs. Public confirmation tickets published both exact Profiles; account readiness followed a successful connection test.
3. Responses Task stored versioned normalized parameters and executed `temperature=0.7`, `max_output_tokens=12`. Public Task events exposed the first `text.delta` while the HTTPS fixture was still holding its terminal event. Artifact and same-request replay were correct; upstream count stayed one.
4. After a true worker process restart, Chat Task read its PostgreSQL snapshot and sent `temperature=0.4`, `max_tokens=9` to `/v1/chat/completions`, exactly once.
5. Unknown and over-limit parameters produced 422 with no Task, reservation, or Provider request.
6. Config version mutation and separate policy disable after submission each made worker dispatch fail before a Provider request, with reservation released.
7. SIGKILL after upstream send, then lease expiry and a new worker PID, produced `upstream_outcome_unknown`, one upstream request total, and `needs_review` reservation. The original taskId was retained and not resent.

## Evidence level and handoff

- This is real local PostgreSQL, Redis DB5, public HTTP, TLS transport, and separate OS worker process evidence against a controlled local Provider fixture. It does not exercise a paid Provider or production deployment.
- The script owns ports 15171 and 15172 only during its run, drops its random child database on completion, and uses a unique Redis prefix. It does not flush shared Redis or access D15200.
- Lead/Verify can run `node scripts/v1-provider-http.mjs` in the main workspace after ensuring dedicated Provider PostgreSQL and Redis DB5 are available. Each run writes a new immutable report/log/manifest stem under `tests/provider/evidence/`.

files_changed: [scripts/v1-provider-http.mjs, .herdr/V1-PROVIDER-r6.md, tests/provider/evidence/V1-PROVIDER-r6-2026-10-02T01-37-05-899Z-13a59b2f.json, tests/provider/evidence/V1-PROVIDER-r6-2026-10-02T01-37-05-899Z-13a59b2f.log, tests/provider/evidence/V1-PROVIDER-r6-2026-10-02T01-37-05-899Z-13a59b2f-manifest.json]
tests_added: [scripts/v1-provider-http.mjs]
commands_run: [node --check scripts/v1-provider-http.mjs, node scripts/v1-provider-http.mjs, git diff --check, dedicated PostgreSQL child database inventory, evidence SHA-256 comparison]
implementation_facts: [separate OS process worker and restart, real PostgreSQL execution snapshot, public HTTP setup and Task observations, controlled HTTPS early delta, sent-unknown no repeat]
contract_changes_proposed: []
open_risks: [full V1 release candidate and paid Provider validation remain separate gates]
docs_to_update: [V1 implementation status and evidence index by Lead/Planner]
uncompleted_items: []

## Post-r6 static compatibility addendum

- `tests/provider/isolated-provider-database.mjs` already permits only the dedicated `dgos_v1_provider` database or an exact `dgos_v1_verify_[0-9a-f]{32}` Verify database. Provider PG tests use that helper, so no Provider test guard changed.
- `tests/integration/postgres-ai-task-atomic.test.mjs` now parses the database name and permits only `dgos_v1_task` or an exact `dgos_v1_verify_[0-9a-f]{32}` name. The fixture ID scoped cleanup is unchanged.
- `scripts/v1-provider-http.mjs` now selects all local migrations through the frozen 0051 and checks the allocation board SHA-256 for frozen 0045 through 0051. Local SQL hashes matched the board, including 0049 `ba0bc80a0ccc74e05a5244b50e52e6a26df39ad854995ba038020b7d5d954f1b` and 0051 `778fddef654d67bc3ecfc01e11fd91f826f91d68a5b6c5c72568b5e35cca1939`.
- Static commands: `node --check tests/integration/postgres-ai-task-atomic.test.mjs` exit 0; `node --check scripts/v1-provider-http.mjs` exit 0; `git diff --check` exit 0; `git diff --no-index --check /dev/null` on each untracked touched file found no whitespace errors (exit 1 means the file differs from `/dev/null`); `shasum -a 256` on 0045 through 0051 matched the board; static `discoverMigrations()` selection returned 47 local files including 0049, 0050, and 0051 (exit 0).
- No PostgreSQL test, full HTTP chain, migration, or product source was run or changed in this addendum. The paired r6 evidence above still proves the historical 45-migration, 9/9 business run with no source drift at that run; the revised 47-migration script has only static validation and awaits the later candidate run.
