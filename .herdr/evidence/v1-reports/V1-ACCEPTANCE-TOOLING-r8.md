# V1-ACCEPTANCE-TOOLING r8

status: passed
scope:
  - V1-ACCEPTANCE-TOOLING-r8; `scripts/verify-release.mjs`, `scripts/v1-regression-sweep.mjs`, focused `tests/tooling/` only.
checks:
  - command: `node --check scripts/verify-release.mjs`; exit_code: 0.
  - command: `node --check scripts/v1-regression-sweep.mjs`; exit_code: 0.
  - command: `node --test tests/tooling/verify-release.test.mjs tests/tooling/v1-acceptance-tooling.test.mjs tests/tooling/release-environment.test.mjs`; exit_code: 0; 19 pass, 0 fail, 0 skip.
  - command: `node scripts/v1-regression-sweep.mjs --plan`; exit_code: 0; discovers 89 main-tree test assets; this is inventory, not an executed product sweep.
  - command: `git diff --check -- scripts/verify-release.mjs scripts/v1-regression-sweep.mjs tests/tooling/verify-release.test.mjs tests/tooling/v1-acceptance-tooling.test.mjs`; exit_code: 0.
evidence_level: local
verified:
  - `sourceIdentity` is exported, parses porcelain-z rename/copy pairs, records HEAD plus a length-delimited dirty-source digest, excludes only explicit generated run paths, and double-captures source. `executeVerification` compares its end snapshot and fails on drift after accurate child database cleanup.
  - Candidate manifests compose by seven required groups: memory, PG, Redis, TLS, browser, native, guarded. Missing, duplicate, stale, failed, skipped, zero-test, uncovered asset/case, placeholder-only and drift states fail the summary. One manifest can be summarized as incomplete without an argument error.
  - Group rows bind result logs and SHA256. Summary checks repository-contained log, test asset and runtime config/envelope/dist bytes, image id/digest equality, manifest/evidence directory pairing, and a second source snapshot after reading assets. Evidence exclusions must be precise generated run directories actually used by the group. Synthetic complete/missing/stale/failed fixtures test this protocol; they are not V1 product evidence.
  - SHA256 `scripts/verify-release.mjs`: `73113d5efae26e2cd6d96d2c8ba82d255d78d6a1ae0bc504fbc755a16dc24a46`.
  - SHA256 `scripts/v1-regression-sweep.mjs`: `69f1c5c8998337e29514edd506b600bfe5580078802e5ee571be2e8fdbb143be`.
  - SHA256 `tests/tooling/verify-release.test.mjs`: `8093cd0c5920827a9f36e5b8157b86121756f48ab9a5bec9f3646b48bbed1a84`.
  - SHA256 `tests/tooling/v1-acceptance-tooling.test.mjs`: `cf24178cbc2ab3fa7a73505e438a4eff7c1e6153f51157a922c0d362d67d943b`.
limitations:
  - No product/full sweep, database migration, D environment, browser or native execution in r8. No actual owner group manifests exist yet; candidate completion and twelve real E2E cases are unverified.
  - Executable memory/PG sweep remains capped at migration <=0044 until Lead publishes the exact frozen candidate list and checksums. Dedicated DB guards, mixed PG subtests and external fixtures still need owner adaptation or separately bound group evidence.
  - Dirty worktree identity does not claim a release commit. Formal docs gate needs a real commit binding plus approvals and applicable NFR evidence.
return_to_lead:
  - Freeze the candidate source/build and migration list; have owners produce real group manifests, logs and runtime asset digests under precise generated run directories. Run `node scripts/v1-regression-sweep.mjs --summarize <group-manifest>...` with all seven groups; exit 0 is required for a complete candidate.
  - Preserve historical r5 failed reports. Treat the r8 synthetic tooling result as a protocol check, not release acceptance.
