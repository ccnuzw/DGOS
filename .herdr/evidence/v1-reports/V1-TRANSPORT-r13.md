# V1-TRANSPORT-BOUNDARY r13 — Worker-C

- status: domain_delivered; awaiting Lead/B/E/I integration and production topology verification
- work_package: V1-TRANSPORT-BOUNDARY r13, ADR-0007 Secret write transport boundary
- workspace: `/Users/apple/Progame/DGOS`, baseline `72ab1cb`
- files_changed: `src/security/request-transport.mjs`, `tests/security/request-transport.test.mjs`, this report. No edits to server, identity, extension/proxy services, deployment, or process environment.
- tests_added: five unit tests for trusted one-hop ingress, direct spoofing, malformed/missing config, direct TLS, authorized local API, and nonproduction fixture rejection.

## Commands run

- `pwd` → `/Users/apple/Progame/DGOS`; `git rev-parse --short HEAD` → `72ab1cb`.
- `node --check src/security/request-transport.mjs` → exit 0.
- `node --check tests/security/request-transport.test.mjs` → exit 0.
- `node --test tests/security/request-transport.test.mjs` → exit 0, 5 pass, 0 fail, 0 skip. An initial run exposed acceptance of `0.0.0.0/0` (4 pass, 1 fail); fixed by rejecting zero-prefix CIDRs, then reran green.
- `git diff --check` → exit 0.
- `shasum -a 256 src/security/request-transport.mjs tests/security/request-transport.test.mjs` → helper `212f49a488b8eabbb770ddd0722be53df85924f9e4964d1feae85418ecb8e986`, test `39e5d5a7c1977917dbc489d9908fb0654a00e0e21a10ba50f79ee836531cb49d`.

## Implementation facts

- `createRequestTransportPolicy({ publicOrigin, trustedProxyCidrs = [], nativeLocalOrigin, fixtureLocalOrigin, allowInsecureFixture = false, nodeEnv })` returns `{ trustProxy, trustedTransport }`. No config means `trustedTransport` is false. Public origin must be an exact `https://` origin. CIDRs must be explicit, valid IP ranges; `/0` is rejected.
- `trustProxy(address, hop)` returns true only for hop 0 whose socket peer is in the declared CIDR set. It does not globally trust proxy chains.
- `trustedTransport(request)` reads `request.raw.socket.remoteAddress`, `localAddress`, `localPort`, `encrypted` and raw normalized headers. A TLS socket is accepted only with the configured public Host and no forwarded transport headers. An HTTP reverse-proxy hop is accepted only from a declared peer with exact Host and singleton `X-Forwarded-Proto: https` plus `X-Forwarded-Host` matching the configured public origin. Conflicting extra forwarded transport headers reject.
- Local native HTTP is enabled only by an explicit loopback `nativeLocalOrigin` with matching loopback peer, local bind address, Host and port. It does not rely on a native header. Local fixture HTTP additionally needs `allowInsecureFixture` plus an exact loopback `fixtureLocalOrigin`, and construction throws in production.

## Contract changes proposed

- Lead: construct the policy from validated deployment settings. Pass `trustProxy: policy.trustProxy` into Fastify construction and `trustedTransport: policy.trustedTransport` to E/I secret-entrypoint route factories. Keep existing Session, fresh-auth, CSRF and scope gates; this callback only decides transport. Do not substitute `request.protocol`, `X-Forwarded-Proto` alone, or `trustProxy: true`.
- B: configure the explicit Caddy-to-API peer IP/CIDR and `DGOS_PUBLIC_ORIGIN` equivalent. Caddy must overwrite forwarded proto and host, and API must be reachable only from the trusted ingress on its internal HTTP listener. Use an explicit loopback bind/origin for native local mode; no arbitrary native-header trust. If deployment cannot guarantee an exclusive trusted ingress, keep the proxy CIDR list empty and fail Secret writes closed.
- E/I: accept `trustedTransport(request)` callback and require truth before Secret write/resolve paths as specified in their packages. Do not infer HTTPS from caller-controlled headers.

## Open risks and limits

- Unit fixtures simulate socket and header inputs; no real Caddy/container or native host transport was exercised. B/Lead must verify actual Caddy header behavior, peer CIDR stability, network isolation and restart configuration before production claim.
- A trusted peer can assert forwarded values by design. Trust depends on B's exclusive ingress and header overwrite. This helper does not authenticate an administrator or authorize a Secret operation.
- No server integration, E/I entrypoint test, production deployment smoke test or broader V1 gate was run in this worker package.
- docs_to_update: Lead/Planner link this implementation and later ingress evidence to ADR-0007/FR secret transport acceptance; B updates deployment contract with concrete peer and public origin settings.
- unfinished_items: Lead server wiring; B deployment settings and Caddy check; E/I callback wiring; integrated transport test.
- lead_or_planner_decisions_needed: no new business decision; deployment must supply concrete trusted ingress CIDR or use fail-closed mode.

Stopped writing after handoff. No commit, push, delegation, service or database operation.
