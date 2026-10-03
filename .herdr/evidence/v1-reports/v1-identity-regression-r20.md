# V1-IDENTITY-REGRESSION r20 — Worker-C handoff

status: script_assertion_repaired; static_checks_passed; live_replay_pending_lead
work_package: V1-IDENTITY-REGRESSION r20 / DGOS-V1-IMPLEMENT-20261002 / V1-platform / V1-FR-010, V1-FR-011
workspace: `/Users/apple/Progame/DGOS` shared main tree; only assigned harness and this report written

files_changed: [`scripts/v1-identity-http.mjs`, `.herdr/V1-IDENTITY-REGRESSION-r20.md`]
tests_added: [strengthened existing live bootstrap compensation stage; no new test file]
commands_run: [`node --check scripts/v1-identity-http.mjs` exit 0; `git diff --no-index --check /dev/null scripts/v1-identity-http.mjs` emitted no whitespace findings, exit 1 because the files differ; `shasum -a 256 scripts/v1-identity-http.mjs` exit 0]

implementation_facts:
- Lead's prior live run remains failed at line 73: `secretKeys` actual 3, expected 1. Its finally receipt reported database, Redis prefix and package root cleaned. That outcome is not rewritten as a pass.
- Current `redis@4.7.1` `scanIterator` yields individual keys. The count was not a page/counting bug. The identity Redis test backend uses a hash with `value` and `purpose`; `revoke` deletes the key. Current server startup also initializes a network provisioning HMAC Secret, so all keys under the shared Secret prefix cannot stand for administrator credentials alone.
- The harness now captures the two `admin-login` Secret refs at `put`, with no credential values recorded. It requires two distinct refs, one matching the only committed principal, and rejects untracked `admin-credential:` keys. It verifies the winner's purpose, subject, `inspect=available`, and `resolve/read` against the original credential. For the loser it requires no readable `value`, `inspect` not available, and `resolve` to fail with `credential_unavailable`. The one-active assertion is derived from successful resolver checks, not a replacement expected key count.
- Existing 20 named stages, two API instances, isolated PG/Redis DB3 resources, permission/rotation/expiry/revoke assertions, and `finally` cleanup remain in the script.

contract_changes_proposed: []
open_risks: [no r20 network replay was run in this sandbox; if Lead's replay finds a loser ref still resolvable, it is a product compensation defect and must return to Lead, not be softened in the harness; the test Redis Secret backend is not production Secret durability]
docs_to_update: [Lead should attach only the result of its actual r20 replay to FR-010/011 verification evidence; preserve the previous failed batch]
unfinished_items: [Lead live replay and inspection of its exact 20-stage result]
lead_or_planner_decisions_needed: []

Script SHA-256 after this change: `412f76a55058363165b75a17f5251786aacf38db9800b29b56be434a829dcad7`.

Lead replay command from the repository root (existing dedicated parent, Redis DB3, ports 15121/15122):

```sh
cd /Users/apple/Progame/DGOS
node scripts/v1-identity-http.mjs
```

This r20 handoff includes no new live test, service, database, Redis or HTTP execution by Worker-C. Stop writing after report.
