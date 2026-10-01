# DGOS AI Task Worker

The worker is an independent consumer of queued `ai_task_attempts`. The API only creates the task and emits `task.accepted`; it does not invoke the provider. Start it with:

```sh
DGOS_DATABASE_URL='postgresql://dgos:dgos@127.0.0.1:5432/dgos' \
REDIS_URL='redis://127.0.0.1:6379' \
DGOS_WORKER_ID='worker-1' \
DGOS_AI_TASK_LEASE_MS=15000 \
DGOS_AI_TASK_HEARTBEAT_MS=5000 \
DGOS_AI_TASK_POLL_MS=1000 \
DGOS_AI_TASK_IDLE_BACKOFF_MS=5000 \
DGOS_AI_TASK_ERROR_BACKOFF_MS=2000 \
pnpm --filter @dgos/worker start
```

`DGOS_WORKER_ID` identifies the lease owner. Heartbeats renew the attempt lease while a provider call is running; a worker that loses its lease cannot write a terminal attempt state or artifact. `Ctrl-C` sends the process stop signal; the runtime stops polling and clears heartbeat timers before exiting. PostgreSQL must be migrated before startup (`pnpm run migrate:plan`).

The process requires `DGOS_DATABASE_URL`, a shared `REDIS_URL`, and positive timing values. API and worker must use the same Redis secret backend. This backend is for local integration, not production KMS. Local fixture routing requires both `DGOS_ALLOW_INSECURE_FIXTURE=1` and `DGOS_FIXTURE_BASE_URL`; only `https://fixture.test/v1/...` is mapped. Production rejects this override. Startup errors exit with status 1; `SIGINT` and `SIGTERM` close PostgreSQL and Redis after the current attempt stops. A crash after sending an upstream request may repeat that request on lease recovery; quota settlement remains idempotent but upstream exactly-once is not guaranteed.

Run the complete isolated environment with `docker compose -f docker-compose.integration.yml up -d --wait --scale worker=2`, then `pnpm run test:release`. It uses disposable PostgreSQL storage and separate ports (Web 14173, API 13000, PostgreSQL 15432, Redis 16379). Run `docker compose -f docker-compose.integration.yml down` to clean up.
