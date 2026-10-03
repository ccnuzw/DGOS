# V1-NETWORK r6 — unified runtime integration

Delivery DGOS-V1-IMPLEMENT-20261002; owner Worker-I; main workspace; prior r5 stopped. Frozen FR001 AC06 and ADR0007. Read r5 report, System public projection/HTTP contract and current API/worker/extension runtime.

Implement actual shared routing for Provider validation/model refresh/Task/probes and MCP HTTP. Lead explicitly transfers network-related import/construction/startup injection regions of `apps/api/src/server.mjs`, `apps/worker/src/worker.mjs`, `src/extensions/runtime.mjs`, and network activation changes in `src/system/{service,repository}.mjs` to I until handoff. Existing owners E/C are stopped; Lead keeps error-handler diagnostics only. Own r5 network modules, new `src/security/system-proxy.mjs` if needed, and focused network integration tests. No edits unrelated to network and no migration without number allocated by Lead.

Requirements:
- Preserve caller endpoint allowlists and fixture isolation; wrapping transport must not let MCP bypass declared host/egress policy. Explicit fixture factory lacks resolveTarget today; handle deliberately and fail closed for unsupported proxy fixture requests.
- Startup captures persisted network settings; PATCH saves desired state, retains actual effective state and marks restart. Activate only on process startup. Do not clear global restartRequired when some live workers still use old route. A consistent process/version acknowledgement or conservative truthful state is required; cover two processes and partial restart.
- System proxy must have a concrete deployment-owned configuration source (e.g. SecretRef startup config); never plaintext proxy auth in ordinary env/logs. No configured system proxy legitimately means direct; configured but unavailable must fail closed. Manual credentials remain SecretRef-backed. Follow frozen semantics; ordinary config shape is engineering choice.
- Public network routes/errors contain no credentials/endpoint internals. Keep 500 diagnostic added by Lead.
- Validate real CONNECT/TLS through public API + worker or authoritative focused integration, not just direct factory calls. Tests prove pending-before-restart, route after restart, revocation, unchanged per-host policy and partial restart truthfulness.

Use only assigned 15181–89, random `dgos_v1_network_<hex>` subdatabase on existing 5432 PG, own temporary resources; no access/restart of D 15200 environment. Coordinate constructor changes by report before D/Lead restart. Existing migrations frozen. Report `.herdr/V1-NETWORK-r6.md` commands/exits/hash/limitations and stop writing.
