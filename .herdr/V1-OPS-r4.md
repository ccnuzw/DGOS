# V1-OPS r4 handoff

- status: local controlled runtime verified; no production deployment claim
- work_package: `V1-OPS` / `r4`
- cwd: `/Users/apple/Progame/DGOS`
- date: 2026-10-02

## files_changed

- `src/security/runtime-config.mjs`: require the absolute extension runtime config path and validate that its file has a nonempty V1 source set before production Secret service startup.
- `scripts/v1-ops-api.mjs`: handle Redis client errors without process exit, disable offline Redis queue, and return HTTP 503 on `/ready` when Secret ciphertext, PostgreSQL or Redis is unavailable.
- `scripts/v1-ops-worker.mjs`: handle the wrapper audit PostgreSQL pool error event. Lead separately owns and fixed the Worker internal pool listener.
- `docker-compose.production.yml`: supply the reviewed image-contained `DGOS_EXTENSION_CONFIG_FILE` to API/Worker alongside package store and trust root mounts.
- `deployment/Dockerfile.dockerignore`: exclude generated Tauri target and gen assets from the image build context.
- `deployment/README.md`: clarify extension runtime config and isolated restore validation write access.
- `tests/security/v1-ops-durable-secret.test.mjs`: require extension config in production fixture.

No B Compose, common server/worker, original `dgos` database, other domain source, commit or push was changed by I.

## commands_run and evidence

| Command / operation | Exit | Observed result |
| --- | ---: | --- |
| `docker build -f deployment/Dockerfile -t dgos-v1-ops-r4-check .` | 0 | D TypeScript and Vite build, prod dependency layer, final image `sha256:24a13a330d9440f7c04194f72ca20f2a25bf529e33289d7d016cf775aa3598cc` |
| Same build after Lead's API/Worker pool fix, tag `dgos-v1-ops-r4-leadfix` | 0 | image `sha256:5e4689447c1e0e9107247281a0edbebf673ba203b08334ff82d0c15e2790f744`; context ~249 KB after ignore rule |
| Isolated `dgos-ops-r4-*` PostgreSQL/Redis/API/Worker on 15181–15184 | 0 | 0001–0040 migrations applied only to ephemeral `ops_r4` database; API `/ready` and `/health` 200; Worker logged ready |
| Cross-process Secret put/resolve/read | 0 | API wrote format 2 ciphertext, Worker read same volume and PostgreSQL audit recorded `secret.resolve.requested` / `secret.read.requested` with digest field |
| Redis stop / start after wrapper fix | 0 | `/ready`: 200 -> 503 -> 200; API process stayed up. Secret read matched the original value with Redis stopped and after restart |
| PostgreSQL stop / start, Lead-fix image | 0 | `/ready`: 200 -> 503 -> 200; API and Worker both stayed up; logs used fixed `database_connection_unavailable` category |
| Revoke old handle and API restart | 0 | stale handle returned `credential_unavailable`; record version advanced to 2 and remained unavailable after API restart |
| Ciphertext backup -> isolated restore | 0 | 1 encrypted record backed up, manifest had no fixture value, restore authenticated 1 record; revoked state/version 2 survived |
| Remove root key then API restart | 1 expected | startup failed `credential_unavailable`; after key return API `/ready` recovered to 200 |
| Caddy internal CA local TLS on 15184 | 0 | `https://localhost:15184/ready` and `/health` returned 200 with `ssl_verify_result=0` using copied ephemeral CA root |
| `node --test tests/security/v1-ops-durable-secret.test.mjs` | 0 | 12/12 unit/security tests passed |
| `node --check` changed OPS modules; `docker compose ... config --quiet`; `git diff --check` | 0 | syntax, Compose parse and diff check passed |

Both dedicated test stacks, their volumes/networks and the copied `/tmp/dgos-ops-r4-root.crt` were removed. B's 15200 group was untouched. The locally built image tags remain on the machine as inspectable build artifacts.

## implementation_facts

- Production config now requires an image-contained extension runtime file. The Compose points both API and Worker to `/workspace/src/extensions/v1-default-runtime.json`. Package storage and operator trust roots remain mandatory; absence fails closed.
- Production API wrapper uses Redis for rate limit and login backoff. On Redis disconnect it returns 503 from `/ready` instead of exiting from an unhandled client `error`; Secret ciphertext stays independent of Redis.
- Lead's newly integrated API and Worker pools were observed in the final image. Their idle error listeners kept both processes running during the PostgreSQL outage; the earlier image, before Lead's fix, had a Worker exit 1 on an unhandled pool error and is superseded by the final r4 retest.

## contract_changes_proposed

- None to HTTP/OpenAPI. OPS production environment now additionally requires `DGOS_EXTENSION_CONFIG_FILE` with an absolute path to a V1 config containing sources.

## open_risks

- Controlled fixture credentials, ephemeral PostgreSQL/Redis, local Caddy CA and localhost ports are local runtime evidence only. No public DNS certificate, external KMS, production signing, production RPO/RTO or real Provider acceptance was tested.
- Secret backup must be coordinated with writes; the restore script needs isolated ciphertext directory write access for its verification lock, although application writes remain disabled pending validation.
- Current extension runtime file is the included first-party V1 profile. Any operator profile replacement needs independent source/sandbox/security validation by E/Lead.
- API readiness checks dependencies; Worker has no HTTP readiness endpoint. The final Worker remained running during PostgreSQL outage, but per-loop recovery and in-flight task effects belong to Lead/B integration verification.

## docs_to_update

- Lead/Planner release docs: record final package trust roots, extension profile, certificate, key management and full multi-store recovery evidence.

## unfinished_items

- External production deployment and release gates remain with Lead/Verify. I r4 work stops here.

## lead_planner_decisions_needed

- No new business decision. Production operator assets and release evidence still need ownership assignment.
