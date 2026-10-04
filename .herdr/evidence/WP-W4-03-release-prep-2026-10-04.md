# WP-W4-03 V1 发布准备证据

- work_package: `WP-W4-03`
- owner: `worker-devops`
- priority: `P1`
- assessed_at: `2026-10-04` (Asia/Shanghai)
- head_commit: `f14a3c9827bd8a9948a5f30f97a546388936b082`
- source_state: dirty shared Wave 4 worktree; no candidate freeze, commit, tag, push, image publication, deployment, or signing performed
- decision: `Pending/Blocked`; Web MVP may remain demonstrable, but V1 Release is not approved

## Gate inventory

| 门禁 | 状态 | 证据与限制 |
| --- | --- | --- |
| Docker image 构建 | `Pending` | `deployment/Dockerfile` and `docker-compose.production.yml` are present. `docker compose -f docker-compose.production.yml config --quiet` exits 1 because production secret, database, root-key, trust-root, public host/origin variables are intentionally unprovisioned. Existing r7 local image (`sha256:4c76f93ed6ae02e96e136cdde90453f39c06a2844f0ccb251b65ba1482031686`) is from an older dirty baseline and cannot certify this candidate. |
| 部署脚本 | `Partial` | `node --check` passes for `scripts/release-environment.mjs`, `scripts/v1-ops-rehearsal.mjs`, `scripts/v1-ops-multistore.mjs`, `scripts/v1-ops-migrate.mjs`, `scripts/v1-ops-api.mjs`, and `scripts/v1-ops-worker.mjs`. `node --test tests/tooling/release-environment.test.mjs` passes 2/2; `node --test tests/tooling/v1-ops-release.test.mjs` passes 1/1. Existing r7 fixture rehearsal passed, but is not target deployment evidence. |
| 性能检查 | `Pending` | `node --test tests/tooling/v1-performance.test.mjs` passes 2/2. r6 is explicitly bounded local calibration and unapproved; no build-bound staging steady-load run, approved thresholds, target topology, RPO/RTO, or performance approver exists. |
| 签名准备 | `Blocked` | `security find-identity -v -p codesigning` reports `0 valid identities found`; no Developer ID identity or notarization credentials are available. Existing desktop app/DMG under `apps/desktop/src-tauri/target/release/bundle/` is local unsigned output and is not a release artifact. |

## Additional release checks

- `node scripts/docs-gate.mjs --phase release --json` exits 1: `APPROVAL_STALE` and `SOURCE_CHANGED_SINCE_COMMIT` are reported.
- `git diff --check` exits 0.
- The authoritative checklist still requires fresh candidate image scan, runtime canary, target backup/restore, performance approval, and release signatures. Historical r7 scan reported 9 Critical and 128 High findings and must not be reused as current-candidate approval.
- Current production Compose refuses missing required inputs by design. No real secret, key, certificate, DNS, target host, external KMS, backup storage, or production Provider was accessed.

## Required unlocks

1. Freeze a clean candidate after WP-W4-01 integration and bind source, migration set, build ID, image digest, and dependency lock.
2. Build and scan that exact image, then run target-host canary and record complete scan output.
3. Provision an approved deployment environment and execute migration, backup, restore, readiness, smoke, rollback, and recovery rehearsal.
4. Run the approved build-bound performance profile and obtain technical approval.
5. Provision Developer ID signing plus notarization credentials, sign the desktop artifacts, verify signatures/notarization, and record the artifact hashes.
6. Obtain product, technical, and release-manager approval in `docs/05-测试与发布/发布/验证证据.md`.

No release approval is granted by this report.
