# V1-CANDIDATE-RUNNER r12 / Verify / 2026-10-02

## Status and scope

- `status`: tooling ready; candidate execution pending Lead's final freeze. Five production test groups were **not** run in this revision.
- `scope`: `scripts/v1-candidate-run.mjs`, `scripts/v1-regression-sweep.mjs`, `scripts/verify-release.mjs`, `tests/tooling/v1-acceptance-tooling.test.mjs`, and this report. No product implementation, migration, browser/native evidence, commit, push, or release approval was changed.
- `evidence_level`: local tooling tests with injected PG/Redis/command runners. The injected execution verifies orchestration logic but is not integration evidence.

## Implemented

`node scripts/v1-candidate-run.mjs --bindings <relative JSON path>` dynamically calls `candidatePlan()` and executes memory, PG, Redis, TLS and guarded groups sequentially. Each group writes an immutable `<run>-<group>.md`, `<run>-<group>-manifest.json` and per-asset raw TAP (or direct harness raw output) under `docs/05-测试与发布/端到端验收/报告/`. Manifests contain exact attempted and unexecuted assets, command exit/signal/timeout, TAP pass/fail/skip, log/source hashes, start/end source identity, resource identity, cleanup and limitations. `candidate_complete` remains false until the separate browser/native manifests and required E2E replacements join `--summarize`.

Memory clears inherited PG and Redis URLs. PG, TLS and guarded each create a random `dgos_v1_verify_<32 hex>` child from the explicitly supplied `dgos_v1_integrated` parent, verify `current_database()`, apply only 47 migrations through frozen 0051 with checksum checks for 0045-0051, set both `DGOS_DATABASE_URL` and `DGOS_EXTENSION_TEST_DATABASE_URL`, and drop exactly that child. TLS passes `DGOS_VERIFY_ADMIN_URL` as the **current child URL** to `real-v1-workflow`; it passes Redis DB5 to Provider and Provider-failures harnesses. Redis test uses DB6, records preexisting matching keys and removes only keys introduced under the test's known `dgos:ratelimit:integration-*` / `dgos:secret:integration/*` patterns; no Redis flush. Timeout is 180 seconds per normal file and 240 seconds for workflow/Provider-failures harness. Fixed ports are probed before each relevant TLS file, never run concurrently.

Independent failed/skipped/zero-TAP files are recorded and the group proceeds. Source drift, malformed Provider evidence receipt, port/resource precondition, or failed cleanup halts dependent work. A group exits zero only when every planned entry has a nonempty successful result and no setup/cleanup error. The Provider subprocess report, log and manifest are excluded from source identity only when the child's stdout names one exact run stem; those generated files are separately SHA-256 bound and rechecked. The `image` binding identifies a candidate artifact only; these five groups run on the host Node process.

## Checks actually run

- `node --test --test-reporter=tap tests/tooling/v1-acceptance-tooling.test.mjs tests/tooling/verify-release.test.mjs`: exit 0; 23 tests passed, 0 failed, 0 skipped. Includes injected five-group run (one memory failure followed by independent success, three exact PG drops), environment/CHILD URL, timeout, migration and receipt checks.
- `node scripts/v1-regression-sweep.mjs --plan`: exit 0, read-only. Current discovery: 101 main-tree tests; memory 50, PG 33, Redis 1, TLS 6, browser Node 2, guarded 4, placeholders 5. Browser assets currently include four `apps/web/e2e/*.spec.mjs` plus package HTTP; native includes `e2e-macos`, `v1-desktop-real`, `visible-macos`; I's direct Provider-failures harness is an additional TLS asset. H's UI management fixture is listed as support, not a passed test. The count must be refreshed at freeze; A/I may still land tests.
- `node --check scripts/v1-candidate-run.mjs`, `node --check scripts/v1-regression-sweep.mjs`, `node --check scripts/verify-release.mjs`, `git diff --check -- scripts/v1-regression-sweep.mjs scripts/verify-release.mjs tests/tooling/v1-acceptance-tooling.test.mjs`: exit 0.

## Final frozen-run input and command

After Lead confirms A/E/D/B/Planner/I/H/F stop receipts, I returns 15181-89, and the source/build is frozen, prepare one repository-relative JSON file for `--bindings` with the r13 file-list binding (see `.herdr/V1-CANDIDATE-RUNNER-r13.md`):

```json
{
  "build_sha256": "<64-hex-final-build-digest>",
  "runtime_assets": {
    "config": { "id": "api-worker-runtime", "files": { "<each-required-runtime-and-trust-root-file>": "<file-SHA256>" } },
    "envelope": { "id": "signed-workbench-envelope-1.0.1", "path": ".herdr/state/package-fixture-r9/ai-workbench-envelope.json", "sha256": "<file-SHA256>" },
    "dist": { "id": "final-web-dist", "root": "apps/web/dist", "files": { "<every-recursively-discovered-dist-file>": "<file-SHA256>" } },
    "image": { "id": "sha256:<final-image-digest>", "sha256": "<same-final-image-digest>" }
  }
}
```

Use a real frozen config path and actual file/image digests; no temporary placeholder digest is accepted as evidence. From repository root:

```sh
DGOS_VERIFY_ADMIN_URL='postgresql://dgos:<local-secret>@127.0.0.1:5432/dgos_v1_integrated' node scripts/v1-candidate-run.mjs --bindings .herdr/state/v1-final-candidate-bindings.json
node scripts/v1-regression-sweep.mjs --summarize <five-generated-manifest-paths> <D-browser-manifest-path> <F-native-manifest-path>
```

The first command prints the five exact manifest paths. The second exits nonzero until all seven groups, fixed replacements, all cases and identical source/build/runtime bindings pass. The `image` hash binds the selected image, and no host test is represented as having executed inside that image.

## Resources and limitations

| Group | Resource | Cleanup / evidence |
| --- | --- | --- |
| memory | Host Node; PG and Redis env removed | Per-file TAP; no DB or Redis allocation |
| PG | Parent `127.0.0.1:5432/dgos_v1_integrated`; random Verify child | Explicit exact `DROP DATABASE <child> WITH (FORCE)` |
| Redis | `redis://127.0.0.1:6379/6` | Only new test-pattern keys removed; before/after recorded |
| TLS | Separate random Verify child; Redis DB5; ports 15171-72, 15181-89 sequentially | Child exact drop; Provider harness owns its own nested child and unique Redis prefix; direct raw output plus receipt artifacts hashed |
| guarded | Separate random Verify child | Exact child drop; zero skip required |
| browser/native | D/H 15175-77 and D 15200 group; F native resources | Not run by this five-group command; require matching separate manifests |

`verified`: five executable entry paths, dynamic root/browser inventory, environment isolation, timeout, failure continuation, cleanup and manifest structure via tooling tests. `limitations`: current source is concurrently changing; the final image/build/config binding has not been supplied; no five-group candidate, browser, native, release gate or production acceptance executed. Existing E2E-09/10 replacement mapping now points at D's actual `real-management.spec.mjs`, but the frozen named assertions remain required and have not been demonstrated by current source/logs. I's new direct harness is present but its 15181-89 allocation remains exclusive until return.

`return_to_lead`: freeze exact source and artifact identity after owner stop receipts; provide final bindings JSON and resource handback, then explicitly schedule the full candidate run. Do not interpret this tooling receipt as V1 acceptance.
