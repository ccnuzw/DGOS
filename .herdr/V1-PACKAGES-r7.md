# V1-PACKAGES r7 delivery

- status: ready_for_Lead_restart_and_D_browser; G implementation and targeted tests complete; live D browser result pending.
- work_package: V1-PACKAGES r7, Worker-G. No commit, push, delegation, Compose restart or write to D's running environment.
- files_changed: `src/apps/package-service.mjs`, `apps/api/src/package-routes.mjs`, `tests/integration/app-package-routes.test.mjs`, this report. Official package manifest/assets, existing envelope and trust root were not changed or regenerated.
- tests_added: ticketed resource without Cookie, opaque Chromium iframe script execution, ticket path restriction, session revocation rejection, package update invalidating old ticket, unauthenticated no-ticket rejection, and no script Cookie/Referer.

## Interface and implementation

`registerPackageRoutes` accepts `validateLaunchSession({ sessionId, subjectId }) => Promise<true>` injected by Lead. The callback must use the server's real identity session store, reject revoked/expired sessions, compare its `principalId` to `subjectId`, and return boolean `true` only for the matching live session. Current `server.mjs` has that exact injection via `identity.getSession`. A false result rejects the ticket; a thrown identity error propagates as its auth error.

For `GET /api/v1/apps/:appId/resources/*?launchTicket=...`, route resolves the server-held random launch record without asking the opaque iframe for a Cookie. The launch record binds sessionId, subjectId, appId, instanceId, installed package digest, expiration, and the exact signed package resource path set. Each request checks ticket/path and calls `validateLaunchSession`; `service.resource` then rechecks current deployment digest and verified on-disk package bytes. Ticket grants static resources only; bridge and all other API endpoints still require their normal authenticated scope. No-ticket resource requests retain `app.lifecycle` scope authentication.

Ticketed static responses keep `no-store`, `nosniff`, `no-referrer` and sandbox CSP with `connect-src 'none'`, `form-action 'none'`, `base-uri 'none'`. For opaque iframe subresources only, response adds `Cross-Origin-Resource-Policy: cross-origin` and `Access-Control-Allow-Origin: null`; no `Access-Control-Allow-Credentials`, wildcard origin or `allow-same-origin` was added. The HTML still substitutes the ticket only into package-relative subresource URLs.

## Commands and evidence

- `node --check src/apps/package-service.mjs` and `node --check apps/api/src/package-routes.mjs`: exit 0.
- `node --test tests/unit/app-packages.test.mjs tests/integration/app-package-routes.test.mjs`: 14/14 pass, including a real Fastify HTTP server on G port 15162 and headless Chromium. The iframe had `sandbox="allow-scripts"` with opaque origin. Ticketed HTML and JS returned 200, JS executed and sent ready; script request carried no Cookie or nonempty Referer. Revoking the fixture session caused 403; installing a newer signed release caused the previous ticket to return 403. Route test also observed no-ticket/no-auth 401 and unlisted ticket path 403.
- `git diff --check -- src/apps/package-service.mjs apps/api/src/package-routes.mjs tests/integration/app-package-routes.test.mjs`: exit 0.
- Source SHA-256: package service `62510839c7eb49ee44213b2f1fda981fd2a5e8ccd21a26dc2f5287735888d72e`; routes `0b0fd548c37bcd4fd67028ec6f802d766435d837bcf38b3db80a4d8db3664d41`; route test `5b2271c3ed8753c25fe6a2d96e0299baf5151bb9867cb5db67b0c77c8d058fbf`.
- Official manifest SHA-256 remained `b7e3654960ed2c27746342a9c098c8ae41baded707f60d3d581e56d0df15ce52`; existing envelope remained `8e465a80d846cd989e6867295456ced7c5579da3392700503e2852e93f616c96`.

## Limits and handoff

- Lead owns restarting the live API/container. D can then rerun the already installed signed package in the real browser. This report's Chromium test used a fresh G-owned signed fixture and real route, not the D integrated environment; live package Task/events/artifact remains unverified here.
- `Access-Control-Allow-Origin: null` is confined to short-lived ticketed signed static bytes; the ticket in subresource URLs remains a bearer secret until expiry. Access logs and reverse proxies must redact `launchTicket` query values. No change to bridge authorization or session transport was made.
- contract_changes_proposed: []
- open_risks: live D browser result and upstream access-log redaction verification.
- docs_to_update: Lead/Planner acceptance evidence after D's real browser run.
- incomplete_items: live environment restart and D's real package Task/browser verification.
- decisions_needed: []
