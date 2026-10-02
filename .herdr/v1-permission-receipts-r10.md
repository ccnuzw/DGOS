# V1-PERMISSION-SETTINGS r10

Worker-C main workspace. r9 stopped. Actual D 500 stack from sanitized API diagnostic:
`TypeError` at `JSON.stringify` -> `src/system/permission-rules.mjs:50:197` -> PostgresPermissionRepository.transaction -> system-routes.mjs:46.
HTTP requestId `1bada2a7-9608-45b1-8c74-d0559fc05327`; body requestId `85d8b225-ba14-4aca-b95b-d1cb301aec46`.

Likely exact cause: normalizeSystemSettings retains source._requestReceipts object by reference. permission adapter normalizes current -> newSettings -> snapshot.settings; adding receipt.result=snapshot into shared receipts makes cycle whenever earlier receipts already exist. r9 fixtures initialized no prior settings writes and missed this.

Allowed writes: `src/system/permission-rules.mjs`, `tests/integration/system-permission-rules.test.mjs`, `.herdr/V1-PERMISSION-SETTINGS-r10.md` only. System service/repository network activation now owned by I r6; do not edit them. Ensure public/persisted receipt snapshots omit internal _requestReceipts; avoid recursively embedding whole receipt history and preserve exact replay result. Cover initial normal Settings PATCH followed by permission PATCH, multiple permission requests/replay, PG atomic rollback audit invariant and memory path. Determine cause by failing regression before fix. Dedicated governance DB only, do not operate D15200. Stop writing with tests/exit/hash report; D will restart/retest when Lead confirms.
