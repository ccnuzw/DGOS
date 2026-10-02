# V1-TASK r3 delivery

status: completed; stopped writing for Lead integration
work_package: V1-TASK r3 / DGOS-V1-IMPLEMENT-20261002
date: 2026-10-02
workspace: /Users/apple/Progame/DGOS
baseline: 72ab1cb
client: Codex Worker-B

## Files changed

- `src/ai-task/repository.mjs`: PostgreSQL submission and terminal Task/Attempt/Quota/Artifact/Event/audit/outbox facts commit in one transaction. Submission locks Provider account then config and rechecks admission before inserts. Claim and upstream-dispatch marker require a matching submit audit and outbox row.
- `src/ai-task/service.mjs`: injects audit and transaction-bound admission into repository, routes all PostgreSQL terminal paths through `completeAttempt`, and propagates terminal transaction failures without reclassifying them as Provider failures. In-memory submit and terminal paths record audit before visible side effects.
- `tests/integration/postgres-ai-task-atomic.test.mjs`: added audit failure rollback, outbox count, account/config state races, cancel failure rollback, and post-dispatch recovery assertions.
- `tests/integration/postgres-ai-task.test.mjs`: proves unaudited manually created Task cannot be claimed, then adds the required audit fixture.
- `.herdr/V1-TASK-r3.md`: this report.

## Interface for Lead and H

`AiTaskService` accepts `audit.record(event, transactionClient)` and `admission({ ownerId, providerConfigId, modelId, intent, transactionClient })`. `PostgresAiTaskRepository.createSubmission(input, reserve, audit, recheckAdmission)` locks `provider_accounts` then `provider_configs` using `FOR UPDATE`; it invokes `recheckAdmission(client)` under both locks. H's account disable/delete and config state transactions must serialize with those rows in that order. `createTaskAdmission` now accepts `transactionClient` in the main tree; Lead should confirm its repository reads use that exact client after H finishes. The preliminary submit admission is only a fast rejection; transaction recheck is authoritative. Existing claimed Task recovery retains its saved attempt and dispatch marker; a marked attempt becomes `upstream_outcome_unknown` with quota `needs_review` and makes no second upstream request.

`completeAttempt({... , audit})` requires the same PostgreSQL client for terminal audit and outbox. `claimAttempt` and `markUpstreamDispatch` require an `ai.task.submit` audit event joined to its outbox row. Historical unaudited queued attempts are intentionally not dispatchable; Lead must decide whether to reconcile or reject those rows.

## Commands and evidence

- `pwd`: `/Users/apple/Progame/DGOS`.
- `git rev-parse --short HEAD`: `72ab1cb`.
- `node --check src/ai-task/service.mjs`, `node --check src/ai-task/repository.mjs`, both changed PG tests: exit 0.
- `git diff --check -- src/ai-task/service.mjs src/ai-task/repository.mjs tests/integration/postgres-ai-task-atomic.test.mjs tests/integration/postgres-ai-task.test.mjs`: exit 0.
- `DGOS_DATABASE_URL=postgresql://dgos:dgos@127.0.0.1:5432/dgos_v1_task node --test --test-concurrency=1 tests/integration/postgres-ai-task-atomic.test.mjs tests/integration/postgres-ai-task.test.mjs tests/integration/postgres-quota.test.mjs tests/integration/ai-task-worker.test.mjs tests/integration/quota-reservation.spec.mjs tests/unit-quota.test.mjs`: 11 passed, 0 failed, 0 skipped. Test fixtures cleaned up in the dedicated database.

## Limits and handoff

- No `ai-task-api.test.mjs` edit or run in this package; Verify owns its egress fixture. No real Provider upstream, shared `dgos` database, service, migration, commit, push, or delegation was used.
- H's concurrent account/config state and delete changes need Lead integration review against the lock contract above. The dedicated test exercises row-lock serialization directly; it is not an end-to-end Provider deletion test.
- In-memory audit-first ordering prevents an audit failure from publishing a Task or terminal state, but later in-memory repository write failures cannot provide PostgreSQL atomic rollback.
- The broad legacy PostgreSQL `createTask` helper can still insert unaudited Task rows for direct callers; the claim/dispatch gates keep these rows from reaching upstream. Recovery or cleanup of existing unaudited rows is a Lead decision.

files_changed: [`src/ai-task/repository.mjs`, `src/ai-task/service.mjs`, `tests/integration/postgres-ai-task-atomic.test.mjs`, `tests/integration/postgres-ai-task.test.mjs`, `.herdr/V1-TASK-r3.md`]
tests_added: [`tests/integration/postgres-ai-task-atomic.test.mjs` r3 assertions, `tests/integration/postgres-ai-task.test.mjs` audit gate assertion]
commands_run: [scoped syntax checks passed, scoped diff check passed, dedicated sequential PostgreSQL suite 11/11 passed]
implementation_facts: [Task submit/terminal audit and outbox share PostgreSQL business transactions, account/config admission is rechecked under row locks, unaudited attempts cannot claim or mark upstream dispatch]
contract_changes_proposed: [Lead/H confirm transactionClient admission and account-then-config lock order, Lead/Planner align `upstream_outcome_unknown` public error if needed]
open_risks: [H integration and deletion race not end-to-end verified, historical unaudited rows need disposition, in-memory later write failure has no rollback]
docs_to_update: [Lead/Planner implementation status and verification evidence after integrated acceptance]
unfinished_items: []
lead_or_planner_decisions: [historical unaudited Task disposition, public `upstream_outcome_unknown` contract]
