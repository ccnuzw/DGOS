# DGOS

DGOS is an extensible desktop and Web application platform. V1 uses React/TypeScript/Vite, Tauri 2, Node.js/Fastify, PostgreSQL, Redis, S3-compatible object storage and isolated workers.

## Current status

The repository is in foundation implementation. It contains the initial Node workspace, API and worker entry points, shared contract packages, security modules, PostgreSQL migration draft and local tests. V1 governance features remain planned until real database, Secret backend, Provider fixture and E2E evidence exist.

## Local setup

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm test
pnpm run check
pnpm --filter @dgos/api dev
```

MinIO is optional for the database/security foundation and is behind the `object-storage` profile. Start it when the registry is available with `docker compose --profile object-storage up -d`.

The API health endpoint is available at `http://127.0.0.1:3000/health`.

## Repository areas

- `apps/api`: Fastify HTTP API entry point
- `apps/worker`: asynchronous worker entry point
- `apps/desktop`: reserved Tauri host boundary
- `packages/sdk`: shared API helpers
- `packages/contracts`: machine-readable contract constants
- `packages/ui`: reserved shared React UI package
- `src/security`: Secret and Provider egress foundation modules
- `migrations`: PostgreSQL schema migrations
- `tests`: local security and migration contract tests
- `docs`: product, architecture, test and release specifications
