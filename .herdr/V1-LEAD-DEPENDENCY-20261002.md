# V1 Lead dependency state / 2026-10-02

## Completed local Lead checks

- Verify tooling TAP: 26 tests passed, 0 failed, 0 skipped.
- `node --check scripts/v1-regression-sweep.mjs`: passed.
- `node --check scripts/v1-candidate-run.mjs`: passed.
- `node scripts/check-docs.mjs`: 0 errors, 3 template warnings.
- `node scripts/spec-docs.mjs facts-sync --check`: 0 findings.
- `git diff --check`: passed.

## Requirement registry decision

The current repository has two different count sources:

- V1 target documents declare 62 AC and 12 first-release E2E.
- The current feature-spec headings expose 42 AC.
- The current E2E matrix exposes 13 rows, including `V1-E2E-16` API supplement.
- NFR/RG sources expose 7/3.

Lead will not change the target count or delete the extra E2E row until Planner reconciles the authoritative source. Verify tooling correctly reports the mismatch and defaults all evidence to `uncovered` without a frozen candidate manifest.

## Dependency graph

1. Planner must reconcile AC/E2E source-of-truth and produce the ordered writeback/task list.
2. Lead must accept that reconciliation without changing product semantics.
3. Workers may then implement only newly confirmed product gaps; completed partial packages are not re-dispatched.
4. A socket-capable verification environment is required for PostgreSQL, loopback fixtures, Chromium, macOS sandbox, Docker/image scan and native Workbench.
5. Verify independently reruns the relevant suites after all writers stop.
6. Lead freezes source, Web dist, native bundle, image, config, envelope/trust roots and 47-migration identity.
7. Only then can candidate groups and release gate execute.

## Current hard blockers

- Planner runtime activation: existing OpenCode pane is idle but not exposed to the Herdr prompt target; no duplicate Planner may be started.
- PostgreSQL loopback EPERM in current shell.
- Chromium Mach-port denial in current shell.
- Docker API permission denial / no fresh image scan.
- macOS sandbox and native Workbench bridge evidence incomplete.
- No candidate bindings, commit binding, approvals or development/e2e/release reports.

## Lead rule

No current Worker report upgrades V1 status. Worker reports are inputs. Verify classifies evidence independently. Planner resolves specification identity. Lead alone integrates and updates the authoritative implementation status and release decision.
