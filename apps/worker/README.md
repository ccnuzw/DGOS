# DGOS AI Task Worker

The worker is an independent consumer of queued `ai_task_attempts`. The API only creates the task and emits `task.accepted`; it does not invoke the provider. Start it with:

```sh
DGOS_DATABASE_URL='postgresql://dgos:dgos@127.0.0.1:5432/dgos' \
DGOS_WORKER_ID='worker-1' \
DGOS_AI_TASK_LEASE_MS=15000 \
DGOS_AI_TASK_HEARTBEAT_MS=5000 \
DGOS_AI_TASK_POLL_MS=1000 \
DGOS_AI_TASK_IDLE_BACKOFF_MS=5000 \
DGOS_AI_TASK_ERROR_BACKOFF_MS=2000 \
pnpm --filter @dgos/worker start
```

`DGOS_WORKER_ID` identifies the lease owner. Heartbeats renew the attempt lease while a provider call is running; a worker that loses its lease cannot write a terminal attempt state or artifact. `Ctrl-C` sends the process stop signal; the runtime stops polling and clears heartbeat timers before exiting. PostgreSQL must be migrated before startup (`pnpm run migrate:plan`).

The process validates `DGOS_DATABASE_URL` and all timing values before opening the consumer loop. For a local fixture provider, set `DGOS_PROVIDER_SECRET` (and `DGOS_PROVIDER_SECRET_REF` when the account credential reference is not `fixture-ref`) plus `DGOS_PROVIDER_ALLOW_HOSTS` to the fixture hostname. Startup errors exit with status 1; `SIGINT` and `SIGTERM` close the pool after the current attempt stops.
