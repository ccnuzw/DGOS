# V1-PG-DIAGNOSTIC r19 — Worker-C

Status: failed_or_incomplete_diagnostic; local isolated PostgreSQL diagnostic only.
Work package: V1-PG-DIAGNOSTIC r19; delivery DGOS-V1-IMPLEMENT-20261002; slices V1-platform / V1-ai-task / V1-assistant.
UTC started: 2026-10-02T04:48:42.857Z; ended: 2026-10-02T04:48:54.095Z.
HEAD: 72ab1cb98b064a6e27b9f60a9f8f00881a827a99; shared dirty source may change concurrently.
Migration selection: 47 frozen files through 0051, ordered set SHA-256 0cb6df60c0bbd5527bc6c8f1314be67fed7dbe6de7f1de30bb8681771af2744d. Full per-file checksums are in the paired manifest.
Parent: dgos_v1_integrated; child: dgos_v1_verify_6769cbb844204fe69d1bbf699f9c381a; cleanup: dropped dgos_v1_verify_6769cbb844204fe69d1bbf699f9c381a.
Source/test hashes changed during this diagnostic: none among recorded paths.
Results: 35 pass, 2 fail, 0 unexecuted; TAP skips 0.
Error: none.

## Selected files and results

| Group | File | Status | Exit | TAP (tests/pass/fail/skip) | Log |
| --- | --- | --- | --- | --- | --- |
| pg | `tests/extensions/management-credential-pg.test.mjs` | pass | 0 | 1/1/0/0 | `.herdr/state/pg-diagnostic-r19/pg-diagnostic-r19-2026-10-02T04-48-42-857Z/01.tap.txt` |
| pg | `tests/extensions/management-custom-run-pg.test.mjs` | pass | 0 | 1/1/0/0 | `.herdr/state/pg-diagnostic-r19/pg-diagnostic-r19-2026-10-02T04-48-42-857Z/02.tap.txt` |
| pg | `tests/extensions/management-definition-pg.test.mjs` | pass | 0 | 1/1/0/0 | `.herdr/state/pg-diagnostic-r19/pg-diagnostic-r19-2026-10-02T04-48-42-857Z/03.tap.txt` |
| pg | `tests/extensions/management-online-pg.test.mjs` | pass | 0 | 1/1/0/0 | `.herdr/state/pg-diagnostic-r19/pg-diagnostic-r19-2026-10-02T04-48-42-857Z/04.tap.txt` |
| pg | `tests/extensions/management-routes-pg.test.mjs` | pass | 0 | 2/2/0/0 | `.herdr/state/pg-diagnostic-r19/pg-diagnostic-r19-2026-10-02T04-48-42-857Z/05.tap.txt` |
| pg | `tests/extensions/management-translation-pg.test.mjs` | pass | 0 | 1/1/0/0 | `.herdr/state/pg-diagnostic-r19/pg-diagnostic-r19-2026-10-02T04-48-42-857Z/06.tap.txt` |
| pg | `tests/integration/action-freshness.test.mjs` | pass | 0 | 3/3/0/0 | `.herdr/state/pg-diagnostic-r19/pg-diagnostic-r19-2026-10-02T04-48-42-857Z/07.tap.txt` |
| pg | `tests/integration/action-recovery.test.mjs` | pass | 0 | 12/12/0/0 | `.herdr/state/pg-diagnostic-r19/pg-diagnostic-r19-2026-10-02T04-48-42-857Z/08.tap.txt` |
| pg | `tests/integration/action-resolve-pg.test.mjs` | pass | 0 | 2/2/0/0 | `.herdr/state/pg-diagnostic-r19/pg-diagnostic-r19-2026-10-02T04-48-42-857Z/09.tap.txt` |
| pg | `tests/integration/audit-query.test.mjs` | pass | 0 | 5/5/0/0 | `.herdr/state/pg-diagnostic-r19/pg-diagnostic-r19-2026-10-02T04-48-42-857Z/10.tap.txt` |
| pg | `tests/integration/network-context-r7.test.mjs` | pass | 0 | 2/2/0/0 | `.herdr/state/pg-diagnostic-r19/pg-diagnostic-r19-2026-10-02T04-48-42-857Z/11.tap.txt` |
| pg | `tests/integration/permission-action-lifecycle.test.mjs` | pass | 0 | 5/5/0/0 | `.herdr/state/pg-diagnostic-r19/pg-diagnostic-r19-2026-10-02T04-48-42-857Z/12.tap.txt` |
| pg | `tests/integration/postgres-ai-task.test.mjs` | fail | 1 | 1/0/1/0 | `.herdr/state/pg-diagnostic-r19/pg-diagnostic-r19-2026-10-02T04-48-42-857Z/13.tap.txt` |
| pg | `tests/integration/postgres-app-packages.test.mjs` | pass | 0 | 3/3/0/0 | `.herdr/state/pg-diagnostic-r19/pg-diagnostic-r19-2026-10-02T04-48-42-857Z/14.tap.txt` |
| pg | `tests/integration/postgres-audit-outbox.test.mjs` | pass | 0 | 2/2/0/0 | `.herdr/state/pg-diagnostic-r19/pg-diagnostic-r19-2026-10-02T04-48-42-857Z/15.tap.txt` |
| pg | `tests/integration/postgres-governance-policy.test.mjs` | pass | 0 | 1/1/0/0 | `.herdr/state/pg-diagnostic-r19/pg-diagnostic-r19-2026-10-02T04-48-42-857Z/16.tap.txt` |
| pg | `tests/integration/postgres-identity.test.mjs` | pass | 0 | 1/1/0/0 | `.herdr/state/pg-diagnostic-r19/pg-diagnostic-r19-2026-10-02T04-48-42-857Z/17.tap.txt` |
| pg | `tests/integration/postgres-migration.test.mjs` | pass | 0 | 2/2/0/0 | `.herdr/state/pg-diagnostic-r19/pg-diagnostic-r19-2026-10-02T04-48-42-857Z/18.tap.txt` |
| pg | `tests/integration/postgres-package-retention.test.mjs` | pass | 0 | 5/5/0/0 | `.herdr/state/pg-diagnostic-r19/pg-diagnostic-r19-2026-10-02T04-48-42-857Z/19.tap.txt` |
| pg | `tests/integration/postgres-provider-lease.test.mjs` | pass | 0 | 1/1/0/0 | `.herdr/state/pg-diagnostic-r19/pg-diagnostic-r19-2026-10-02T04-48-42-857Z/20.tap.txt` |
| pg | `tests/integration/postgres-provider.test.mjs` | pass | 0 | 1/1/0/0 | `.herdr/state/pg-diagnostic-r19/pg-diagnostic-r19-2026-10-02T04-48-42-857Z/21.tap.txt` |
| pg | `tests/integration/postgres-quota.test.mjs` | pass | 0 | 2/2/0/0 | `.herdr/state/pg-diagnostic-r19/pg-diagnostic-r19-2026-10-02T04-48-42-857Z/22.tap.txt` |
| pg | `tests/integration/postgres-retention.test.mjs` | pass | 0 | 2/2/0/0 | `.herdr/state/pg-diagnostic-r19/pg-diagnostic-r19-2026-10-02T04-48-42-857Z/23.tap.txt` |
| pg | `tests/integration/postgres-runtime.test.mjs` | pass | 0 | 1/1/0/0 | `.herdr/state/pg-diagnostic-r19/pg-diagnostic-r19-2026-10-02T04-48-42-857Z/24.tap.txt` |
| pg | `tests/integration/proxy-provisioning-r7.test.mjs` | pass | 0 | 3/3/0/0 | `.herdr/state/pg-diagnostic-r19/pg-diagnostic-r19-2026-10-02T04-48-42-857Z/25.tap.txt` |
| pg | `tests/integration/runtime-api.test.mjs` | pass | 0 | 3/3/0/0 | `.herdr/state/pg-diagnostic-r19/pg-diagnostic-r19-2026-10-02T04-48-42-857Z/26.tap.txt` |
| pg | `tests/integration/system-cross-process.test.mjs` | pass | 0 | 4/4/0/0 | `.herdr/state/pg-diagnostic-r19/pg-diagnostic-r19-2026-10-02T04-48-42-857Z/27.tap.txt` |
| pg | `tests/integration/system-http-projection.test.mjs` | pass | 0 | 6/6/0/0 | `.herdr/state/pg-diagnostic-r19/pg-diagnostic-r19-2026-10-02T04-48-42-857Z/28.tap.txt` |
| pg | `tests/integration/system-permission-rules.test.mjs` | pass | 0 | 8/8/0/0 | `.herdr/state/pg-diagnostic-r19/pg-diagnostic-r19-2026-10-02T04-48-42-857Z/29.tap.txt` |
| pg | `tests/provider/provider-audit-atomic.test.mjs` | pass | 0 | 1/1/0/0 | `.herdr/state/pg-diagnostic-r19/pg-diagnostic-r19-2026-10-02T04-48-42-857Z/30.tap.txt` |
| pg | `tests/provider/provider-parameters-pg.test.mjs` | pass | 0 | 1/1/0/0 | `.herdr/state/pg-diagnostic-r19/pg-diagnostic-r19-2026-10-02T04-48-42-857Z/31.tap.txt` |
| pg | `tests/provider/provider-protocol-confirmations.test.mjs` | pass | 0 | 1/1/0/0 | `.herdr/state/pg-diagnostic-r19/pg-diagnostic-r19-2026-10-02T04-48-42-857Z/32.tap.txt` |
| pg | `tests/provider/provider-text-directory.test.mjs` | pass | 0 | 2/2/0/0 | `.herdr/state/pg-diagnostic-r19/pg-diagnostic-r19-2026-10-02T04-48-42-857Z/33.tap.txt` |
| guarded | `tests/extensions/postgres-extension.test.mjs` | pass | 0 | 4/4/0/0 | `.herdr/state/pg-diagnostic-r19/pg-diagnostic-r19-2026-10-02T04-48-42-857Z/34.tap.txt` |
| guarded | `tests/integration/network-runtime-r6.test.mjs` | pass | 0 | 1/1/0/0 | `.herdr/state/pg-diagnostic-r19/pg-diagnostic-r19-2026-10-02T04-48-42-857Z/35.tap.txt` |
| guarded | `tests/integration/postgres-ai-task-atomic.test.mjs` | fail | 1 | 1/0/1/0 | `.herdr/state/pg-diagnostic-r19/pg-diagnostic-r19-2026-10-02T04-48-42-857Z/36.tap.txt` |
| guarded | `tests/integration/postgres-governance-hardening-r3.test.mjs` | pass | 0 | 2/2/0/0 | `.herdr/state/pg-diagnostic-r19/pg-diagnostic-r19-2026-10-02T04-48-42-857Z/37.tap.txt` |

## First failures

### tests/integration/postgres-ai-task.test.mjs

```text
not ok 1 - PostgreSQL persists provider catalogs, policies, tasks, ordered events and artifacts
  ---
  duration_ms: 54.575084
  type: 'test'
  location: '/Users/apple/Progame/DGOS/tests/integration/postgres-ai-task.test.mjs:9:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:
    + actual - expected
    
    + {
    +   attemptId: 'f8940069-94e6-462e-b32e-278bc4075eda',
    +   attempts: 1,
    +   completedAt: null,
    +   errorClass: null,
    +   leaseOwner: 'postgres-test-worker',
    +   leaseUntil: 2026-10-02T04:48:48.611Z,
    +   modelId: 'text-model',
    +   providerAccountId: 'b6ae23e6-1ba3-4146-8d64-c55fb87074fd',
    +   providerConfigId: 'b9f33f1e-d557-4ddb-8195-de711b3192b2',
    +   quotaReservationRef: '6903d936-c288-4004-9580-fa53f080e313',
    +   startedAt: null,
    +   state: 'running',
    +   taskId: '2e8d35e3-272f-44df-9570-be87dde58e69',
    +   upstreamDispatchStartedAt: null
    + }
    - undefined
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  actual:
    attemptId: 'f8940069-94e6-462e-b32e-278bc4075eda'
    taskId: '2e8d35e3-272f-44df-9570-be87dde58e69'
    providerConfigId: 'b9f33f1e-d557-4ddb-8195-de711b3192b2'
    providerAccountId: 'b6ae23e6-1ba3-4146-8d64-c55fb87074fd'
    modelId: 'text-model'
    state: 'running'
    errorClass: ~
    quotaReservationRef: '6903d936-c288-4004-9580-fa53f080e313'
    upstreamDispatchStartedAt: ~
    leaseOwner: 'postgres-test-worker'
    leaseUntil: 2026-10-02T04:48:48.611Z
    attempts: 1
    startedAt: ~
    completedAt: ~
```

### tests/integration/postgres-ai-task-atomic.test.mjs

```text
not ok 1 - submission rollback, atomic terminal facts, and uncertain dispatch fence
  ---
  duration_ms: 37.095084
  type: 'test'
  location: '/Users/apple/Progame/DGOS/tests/integration/postgres-ai-task-atomic.test.mjs:11:1'
  failureType: 'testCodeFailure'
  error: |-
    The input did not match the regular expression /quota_exceeded/. Input:
    
    "TypeError: Cannot read properties of undefined (reading 'normalizedParameters')"
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
  actual:
  error: "Cannot read properties of undefined (reading 'normalizedParameters')"
  name: 'TypeError'
  stack: |-
    snapshotFor (file:///Users/apple/Progame/DGOS/src/ai-task/service.mjs:6:79)
    AiTaskService.submit (file:///Users/apple/Progame/DGOS/src/ai-task/service.mjs:34:42)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    async waitForActual (node:assert:644:5)
    async Function.rejects (node:assert:767:25)
    async TestContext.<anonymous> (file:///Users/apple/Progame/DGOS/tests/integration/postgres-ai-task-atomic.test.mjs:39:5)
    async Test.run (node:internal/test_runner/test:1054:7)
    async startSubtestAfterBootstrap (node:internal/test_runner/harness:296:3)
  operator: 'rejects'
  stack: |-
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    async TestContext.<anonymous> (file:///Users/apple/Progame/DGOS/tests/integration/postgres-ai-task-atomic.test.mjs:39:5)
    async Test.run (node:internal/test_runner/test:1054:7)
    async startSubtestAfterBootstrap (node:internal/test_runner/harness:296:3)
  ...
1..1
# tests 1
# suites 0
# pass 0
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 101.3265

```

## Scope and limitations

- Product code, tests, shared scripts, TLS/browser/native/Redis groups and release gates are outside this run.
- Current shared B/F/Verify changes mean this is a diagnostic snapshot, not a complete candidate or V1 acceptance.
- A process exit of zero with TAP skips is recorded as unproven for the skipped assertions.
- Recognizable database URLs and credential values are redacted before TAP logs, failures or errors are stored; a redacted log is not byte-for-byte raw output.
- Only the recorded local child was created and cleaned; nested test resources remain each test’s responsibility.

## Lead execution

```sh
cd /Users/apple/Progame/DGOS
DGOS_VERIFY_ADMIN_URL='postgresql://dgos:dgos@127.0.0.1:5432/dgos_v1_integrated' node .herdr/state/pg-diagnostic-r19/run.mjs --run
```

Command exit 0 requires every selected file to pass with zero TAP skips and successful child cleanup; otherwise exit 1.

