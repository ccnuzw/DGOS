# V1-STREAM-TRANSPORT r1 / Lead

2026-10-02, main dirty worktree, base HEAD72ab1cb. Local controlled TLS evidence; full Task/browser and proxy stream validation pending H/I.

`src/security/provider-egress.mjs` previously returned buffered body only after upstream EOF. Added explicit `streamResponse:true` returning a bounded async iterator after response headers. Default JSON/probe paths remain buffered. Real TLS stream keeps response byte limit, total request deadline, cancellation propagation and premature-consumer cleanup. Stable transport errors omit raw upstream messages.

`node --test tests/security/provider-egress-stream.test.mjs tests/security/provider-egress-transport.test.mjs tests/security/provider-egress.test.mjs` exited0:8pass/0fail/0skip. New controlled TLS case holds upstream completion until first chunk has been consumed, then verifies last chunk/EOF, oversized body, abort, total deadline despite recurring bytes, and closing transport when consumer returns early. Existing target pinning/TLS/redirect/private-DNS tests also passed. `git diff --check` on changed files exited0.

Only Lead-owned direct transport and new test edited. H must explicitly select streaming in adapter after Provider task-package Ready; I owns proxy streaming equivalent. These tests do not claim full NFR007 or real external Provider acceptance.

Follow-up: total budget now includes DNS; optional resolveTarget(url,{signal,timeoutMs}) bounds stalled DNS and cancellation before transport. Same command passed9/9 after adding DNS timeout/cancel case; buffered/streaming regression stayed green. Proxy owner I notified to propagate remaining budget.
