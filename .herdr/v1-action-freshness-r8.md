# V1-ACTIONS r8 — high-risk execute and permission transaction

Worker-A main workspace, previous r7 stopped. Read FR009 AC03/06, technical design and FR010 freshness rules, current action/public schema. Actual current routes execute only writeAuth/confirmed; generic system.settings.patch and appPermissions must not bypass stronger domain rules.

Allowed paths: `src/actions/{routes,service,system-actions,runtime}.mjs`, `src/permissions/builtin-declarations.mjs` only required permission capability, new `tests/integration/action-freshness.test.mjs` and focused owned action tests, report `.herdr/V1-ACTIONS-r8.md`. Lead explicitly transfers action runtime ownership; I only owns network portions in API/worker/System. `src/system/permission-rules.mjs` C r10 now stopped and should be reused, not rewritten. Lead will inject requireFreshSession at one server registerActionRoutes call.

Implement:
- High/elevated, permissions/privacy/network execution requires server-derived fresh administrator Session, never trust body boolean/timestamp/sessionId. Missing verifier fails closed for elevated action. Reauthenticate after plan when stale; reject API Key for session-required actions, bind plan subject. Validate current action classification to avoid downgrade/race. Preserve confirmed/input/version/idempotency and worker-side permission recheck.
- Both generic and per-domain system permission writes use createSystemPermissionRules atomic adapter with permission.manage + system.settings.write. Correct input schema for rules. Generic action must not be a medium-risk bypass for sensitive domains. Do not register duplicate competing public DTOs or silently remove required domain capability.
- Tests through real buildServer HTTP assert stale session/Key denied before Run/handler, fresh confirmed success, mismatch/expired plan/no side effect, permission settings mutate authoritative Broker and CAS/audit/replay, worker execution rechecks permissions. Include independent PG path on A database 5432 dgos_v1_actions only; no D15200. C receipt16/16 alone doesn't prove action path.

No new migration without allocation. Report test results and stable source hashes; stop writing. Only action-specific regions; preserve all other uncommitted work.

Lead addendum: allowed `apps/api/src/system-routes.mjs` only stable fingerprint and sensitive-domain fresh Session enforcement. Lead injects requireFreshSession into registerSystemRoutes. HTTP and Action must use consistent normalized intent digest despite PG jsonb key order; no package signing serializer dependency for business floats. Focused System route test fixture adaptation is allowed after read-only owner check; preserve exact auth semantics.
