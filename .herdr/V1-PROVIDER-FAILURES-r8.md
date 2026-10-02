# V1-PROVIDER-FAILURES r8 — Worker-I

status: independent_post_fix_matrix_passed; final_candidate_drift_check_pending
work_package: V1-PROVIDER-FAILURES r8 / V1-FR-013 AC02, AC04
workspace: /Users/apple/Progame/DGOS

## Scope and pre-existing evidence

I stopped the prior network/proxy assignment; ops belongs to B. This package writes only the new Provider failure harness, this report, and its immutable evidence. H's `scripts/v1-provider-http.mjs` r6 had public HTTP + real PG/Redis/TLS and a separate OS worker for a successful connection test, but its restarted/SIGKILL worker scenarios concern AI Tasks. `tests/integration/provider-worker.test.mjs` cancellation uses in-memory repository and an injected adapter; `tests/integration/provider-test-loop.test.mjs` tests only loop polling. Neither proves the real independent-process FR013 error/cancel matrix.

## Original pre-fix run

Command: `node scripts/v1-provider-failures-http.mjs` from the main workspace. Exit 1, 8 cases, 5 passed and 3 failed. It used parent `dgos_v1_provider` at `127.0.0.1:5432`, random child `dgos_v1_provider_failures_3abfcf64789ab0673a3d834880f471e1`, Redis DB5 exact prefix `v1-provider-failures:3abfcf64789ab0673a3d834880f471e1`, public API15181, trusted TLS fixture15182, untrusted TLS fixture15183 and an unbound 15184 network target. OS worker PIDs were 94395, 94396 and replacement 95285. The harness applied all 47 frozen migrations through0051 and verified frozen 0045–0051 SHA-256 values before setup. Source hashes matched before and after this run (`sourceStable=true`).

| Case | Actual result | Interpretation |
| --- | --- | --- |
| `authentication_failed` | passed: failed/authentication_failed, 1 request, 1 finish audit | AC02 branch proven locally |
| `rate_limited` | failed: expected failed/rate_limited, actual failed/upstream_unavailable | 429 stable classification defect; A r17 owns probe helper |
| `protocol_mismatch` | failed: expected failed/protocol_mismatch, actual succeeded on malformed HTTP200 body | false success defect; A r17 owns probe helper |
| `tls_invalid` | passed: failed/tls_invalid, 0 accepted fixture requests, 1 finish audit | AC02 TLS branch proven locally |
| `network_unreachable` | passed: failed/network_unreachable, 0 accepted fixture requests, 1 finish audit | AC02 network branch proven locally |
| `timed_out` | passed: timed_out after held TLS response, 1 request, 1 finish audit | AC04 deadline branch proven locally |
| `running_cancel` | failed: cancelled after 15009ms versus under 7000ms assertion; original failed case did not record socket state | AC04 prompt abort unproven; A r17 owns signal/worker handling |
| `two_workers_restart_terminal_unique` | passed: killed worker after first send, lease expired in isolated child PG, new worker converged same testId to success, attempts=2, upstream calls=2, exactly 1 finish audit; no request after terminal | The second request follows sent-unknown recovery; no stronger at-most-once upstream claim |

The harness also compares Task, quota reservation, model catalog, catalog entry and policy counts around each connection test; validates public/recorded audit/log projections against the fixture credential; and checks terminal re-poll produces no additional request. The original failed cases stopped at their first assertion, so their later invariant checks remain unproven in this original run. The current harness preserves observed facts for failed cases and checks the post-terminal request count, ready for independent replay after A stops.

Original immutable files:

- `tests/provider/evidence/V1-PROVIDER-FAILURES-r8-2026-10-02T03-16-29-684Z-3abfcf64.json` SHA-256 `8ae743c04042c96de25e22655aff236012aaaf61065a7be266b3922f489f09a2`
- Same stem `.log` SHA-256 `435a11c7dbfcbc35b308ea2e64fa54f691a13b6662d36e912cbc15e57fdede26`
- Same stem `-manifest.json` SHA-256 `d74b569b5d2d41990248221a0212149fc5d74ffb0a6ab4fae67af7a8e3beef16`
- Original run harness SHA-256 `3d23bdfdc1120114c1d71920ec3232bd7930091fd0669c91033c4f3745ba9e8d`; the report and manifest retain the full before/after source map. Subsequent I-only harness changes do not rewrite this baseline.

## Harness closeout and handback

`scripts/v1-provider-failures-http.mjs` currently SHA-256 `8da2554f528e42312a40d0a75ac7d47b33e629f789f439ed97478e0b4eea8cb0` after I-only evidence improvements. It now marks final `status=failed` if source hashes drift during a run, retains facts on per-case failures, checks independent invariants before expected classifications, immediately rejects a command when its child exits, and emits the exact final JSON line `{status,cases,reportPath,logPath,manifestPath}` for Verify. It accepts default dedicated parent or `DGOS_VERIFY_ADMIN_URL` matching `dgos_v1_verify_[0-9a-f]{32}`; it creates a fresh random child under that parent, never runs migrations on the parent, and deletes only that child and its exact DB5 prefix.

Commands and observed results: `node --check scripts/v1-provider-failures-http.mjs` exit 0; `git diff --check -- scripts/v1-provider-failures-http.mjs` exit 0; Node `pg` query found zero `dgos_v1_provider_failures_%` child databases; Redis SCAN of the run's exact DB5 prefix found zero keys after six were removed; `lsof -nP -iTCP:15181-15189 -sTCP:LISTEN` found no listeners (exit 1). `psql` CLI was unavailable; the Node PG query supplied the database inventory. No product file, old harness, migration, or other work package path was edited by I.

## Independent post-A r17 replay

A's `.herdr/V1-PROVIDER-PROBE-FIX-r17.md` recorded final stop-writing and focused 10/10; its product hashes match this run. I loaded fresh API and worker processes and executed `node scripts/v1-provider-failures-http.mjs` once. Exit 0, all eight cases passed with `sourceStable=true`; source before/after hashes match in the paired manifest. The two initial worker PIDs were 193 and 194, and the restarted replacement was 275. This run used fresh child `dgos_v1_provider_failures_7b857c3922d7788be4bd814ae6bfe098`, fresh DB5 prefix `v1-provider-failures:7b857c3922d7788be4bd814ae6bfe098`, and the same 47 frozen migrations through0051.

| FR013 branch | Post-fix actual observation |
| --- | --- |
| AC02 authentication | `failed/authentication_failed`; 1 upstream request, 1 terminal audit |
| AC02 rate limit | `failed/rate_limited`; 1 request, 1 terminal audit |
| AC02 protocol | malformed 200 became `failed/protocol_mismatch`; 1 request, 1 terminal audit |
| AC02 TLS/network | `failed/tls_invalid` and `failed/network_unreachable`; 0 accepted fixture requests each, 1 terminal audit each |
| AC04 timeout | held TLS probe became `timed_out`; 1 request, 1 terminal audit |
| AC04 running cancel | `cancel_requested` became `cancelled` in 247ms; exactly 1 already-sent request, 0 fixture responses open at terminal, 1 finish audit, no new request after terminal re-poll |
| AC04 two-worker restart | same testId succeeded after first worker SIGKILL and isolated lease expiry; attempts=2, upstream calls=2 because first had already sent, 1 finish audit; subsequent re-polls produced no request |

Each case checked unchanged Task, quota reservation, catalog, catalog entry and policy counts; public connection-test, audit summaries and captured logs contained no fixture credential or secret reference. The restart case proves unique terminal/audit convergence while allowing the already-sent uncertainty; it does not prove at-most-once upstream delivery. No new cancellation audit or late-request defect was observed.

Post-fix immutable files:

- `tests/provider/evidence/V1-PROVIDER-FAILURES-r8-2026-10-02T03-23-31-103Z-7b857c39.json` SHA-256 `db708961c0a19d403f71d4f7f879b781bd94fff13d4d8ba6a59900578b0d108d`
- Same stem `.log` SHA-256 `2ffa5abb3f41ed291fa4d88ce70b0c7fdba93b2f275ef7dd2dfdc484eb2bf2dc`
- Same stem `-manifest.json` SHA-256 `5ee071266cc2ab317cdf0c8e6a098306b097daf1e8d124c2a1f81bd43d7bb5ab`
- Harness `8da2554f528e42312a40d0a75ac7d47b33e629f789f439ed97478e0b4eea8cb0`; probe helper file `6be98c6fcfbdea7e60885c63d01746d4a7c33bbf9b103bbe9c76f672c833aeae`; Provider test worker file `54282d45567350a3ac3578946623764ea9a711968d59b93d956127c4103d1864`. Full seven-asset map is in the JSON/manifest.

Post-run Node PG inventory found zero `dgos_v1_provider_failures_%` databases, exact-prefix Redis DB5 SCAN found zero keys after six removed, and `lsof -nP -iTCP:15181-15189 -sTCP:LISTEN` found no listeners. Ports 15181–15189 are returned to Verify. Verify can set strict `DGOS_VERIFY_ADMIN_URL` to a dedicated parent and run the same command. A later final-candidate replay is needed only if relevant source bytes differ from this post-fix pass. No paid Provider was accessed.

files_changed: [scripts/v1-provider-failures-http.mjs, .herdr/V1-PROVIDER-FAILURES-r8.md, original and post-fix evidence JSON/log/manifest]
tests_added: [scripts/v1-provider-failures-http.mjs]
commands_run: [node --check scripts/v1-provider-failures-http.mjs, node scripts/v1-provider-failures-http.mjs twice with separate baseline/replay evidence, git diff --check -- scripts/v1-provider-failures-http.mjs, Node PG child database inventory, Redis DB5 exact-prefix SCAN, lsof port inventory, shasum -a 256 on script/product sources/evidence]
implementation_facts: [public API and real PG/Redis/TLS with independent worker processes executed all 8 cases twice; 3 pre-fix failures sent to Lead/A; post-A replay passed 8/8 with stable source; exact resources cleaned and ports returned]
contract_changes_proposed: []
open_risks: [final candidate source identity comparison pending, external Provider/target deployment CA not covered]
docs_to_update: [FR013 AC02/AC04 evidence mapping; Lead/Planner owns authority writeback]
unfinished: [source-drift-triggered final candidate replay only if relevant bytes change]
lead_or_planner_decisions: []
