# V1-ACTIONS r2 controlled integration

- Delivery: `DGOS-V1-IMPLEMENT-20261002` / `V1-ACTIONS-r2`
- Worker: Worker-A
- Target cwd: `/Users/apple/Progame/DGOS`
- Source: `/Users/apple/Progame/DGOS/.worktrees/v1-actions` (`V1-ACTIONS-r1`, baseline `72ab1cb98b064a6e27b9f60a9f8f00881a827a99`)
- Status: source transfer completed; Lead owns shared API/worker wiring, migrations in integrated environment, and cross-domain regression.

## Scope and integrity

Before transfer, `git status --short -- <allowed targets>` and `git diff -- <existing targets>` were empty. The following files were transferred using `apply_patch` only. SHA-256 was computed on the r1 source and again on the main-workspace target; each pair matched exactly:

| Target | SHA-256 |
| --- | --- |
| `src/actions/repository.mjs` | `6596aa740fdc16833a3927dd75c750265ca07f5379126e85df3bf3be095fadc9` |
| `src/actions/service.mjs` | `a1ec27df351bdced220dff6ad7fe853ffebda0222ba7187d169dd5a819f44466` |
| `src/actions/routes.mjs` | `d5f7d1732d9f04c071f509f9c7bfc40540fe8eb70db9f65c934525e0529694f9` |
| `src/actions/system-actions.mjs` | `072022382264ed59f2cb6a6e2961f2395f59155d133c3280a1d7f2df1ee89197` |
| `src/actions/worker.mjs` | `1fc57b7948707b2220e06c31a1a01ce44a7525073a5b41d4d33216c5fdfe8bb0` |
| `migrations/0016-action-input-recovery.sql` | `c084c94a7b676ef4d4fa9823decaf8d9174315ee8bad8096c38f5b7e314d9dfc` |
| `migrations/0017-action-recovery-guard.sql` | `a3fb760d103d5fbb3a31d67f4fa6973982d169bb19a10ab2c3e13bca9c57d8ad` |
| `migrations/0018-action-cancel-guard.sql` | `8a5d8b799e25fc219e42a935556e2429ff26609ee3fd05a233257bc6f4f0856c` |
| `tests/integration/action-recovery.test.mjs` | `a0d6e7619bfc286d311c81e9c958c752864908eaa3accc9085e28b7be3d8c75f` |

`tests/unit/runtime.test.mjs` was intentionally not transferred because Worker-G overlaps that file. Lead should apply this one-line Action assertion inside the `action plan has no handler side effect and executes once` test:

```diff
- assert.equal(run.handlerCalls, 1);
+ assert.equal((await service.get(run.runId, 'u')).handlerCalls, 1);
```

The returned Run is a redacted snapshot; the handler advances the repository state asynchronously. No other part of that test needs to be replaced by A's diff.

## Checks and evidence

- `node --check` on all five Action modules plus the integration test: exit 0.
- `git diff --check`: exit 0.
- Main-workspace target status after transfer: two modified existing Action files, seven added Action/migration/test files; `tests/unit/runtime.test.mjs` unchanged by this transfer.
- Tests and database commands were **not run in r2** by instruction. The prior r1 source test in the isolated `dgos_v1_actions` database passed 24/24, 0 skipped; see source worktree `DELIVERY-V1-ACTIONS-r1.md`. This is evidence for r1 source, not integrated-main acceptance.
- No database, server, Redis, commit, push, or delegation operation was performed in r2.

## Lead integration points and limits

1. Apply migration 0016–0018 after 0015 in the integrated database before starting the Action worker.
2. In shared `apps/api/src/server.mjs`, use `autoDispatch:false` with PostgreSQL, register `registerActionRoutes`, and register `registerSystemActions` with the existing SystemService plus D's navigation adapter. Remove or replace inline Action routes to avoid duplicates. Preserve Session/CSRF wrappers.
3. In shared worker bootstrap, create `ActionService` with the same Postgres repository, registry, definitions and handlers; start `ActionWorker`, and drain it on shutdown. Multiple workers use `FOR UPDATE SKIP LOCKED`.
4. `resolveNaturalLanguageCandidates` returns filtered candidates only. A public NL route/response needs Lead/Planner contract coordination; execute still goes through Plan, confirmation and permission checks.
5. Navigation Run `resultSummary.navigation.target` contains only a registered target. D must map it to an allowlisted UI route; it is not native-window-open evidence.

The code retains cooperative cancellation and an explicit `outcome_unknown` state after an ambiguous claimed handler. Persisted Action input is PostgreSQL JSONB, so secret-bearing actions require separate SecretRef review. Full FR-001/009 and V1 gates remain open pending shared wiring and Verify's independent evidence.
