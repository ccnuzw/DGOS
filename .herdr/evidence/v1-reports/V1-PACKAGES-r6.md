# V1-PACKAGES r6 delivery

- status: ready_for_lead_and_D; public package seed complete; browser Task acceptance remains open.
- work_package: V1-PACKAGES r6, Worker-G. No commit, push, delegation, Compose restart, direct DB write, quota/model mutation, or write to user app data.
- files_changed: `scripts/v1-package-fixture.mjs`, `tests/integration/app-package-fixture.test.mjs`, this report. Generated, gitignored runtime assets: `.herdr/state/package-fixture/trust-roots.json` and `ai-workbench-envelope.json`.
- tests_added: one integration test for signed fixture generation and the public HTTP login, submit, install, deployment, seven permission PATCH sequence against a local controlled HTTP server.

## Implementation facts

The script has `generate` and `seed` modes. `generate` creates a fresh Ed25519 keypair, puts the private key only in a system temporary directory with 0700 directory and 0600 file permissions, emits a public official test root and signed AI Workbench envelope to the ignored runtime directory, and verifies the envelope before output. No private key or credential is printed or stored in the repository. The root is a local controlled test root; production must not automatically trust it.

`seed` requires an explicit localhost HTTP URL and `DGOS_PACKAGE_FIXTURE_PRINCIPAL_ID` plus `DGOS_PACKAGE_FIXTURE_CREDENTIAL` in the environment. It verifies the signed envelope against the public root before requests. It then logs in using the existing admin, submits the envelope with its fixed requestId, checks the official release digest, installs it for the authenticated subject if absent, reads `GET /apps/{appId}/deployment`, and explicitly grants the seven manifest capabilities using seven `PATCH /permissions` calls. It does not bypass PermissionBroker or write DB rows directly. Output contains only app/version/subject/digest, scope decisions and asset paths.

## Paths and hashes

- Root: `/Users/apple/Progame/DGOS/.herdr/state/package-fixture/trust-roots.json`; SHA-256 `1a7e559f147185c93a185c5582c818d135f4a6a7acc442da2a9624e2d72f26c5`.
- Envelope: `/Users/apple/Progame/DGOS/.herdr/state/package-fixture/ai-workbench-envelope.json`; SHA-256 `8e465a80d846cd989e6867295456ced7c5579da3392700503e2852e93f616c96`.
- Test root keyId: `official-fixture-a27de959-3f6a-426b-a6f0-4b30e90cf6b4`; signed package digest `sha256:9822e57540f4ca3ea7f8b0b5dcd2d3a61d4939fe0110c56e6f1377bd225586ee`.
- Script SHA-256 `49a40e574e3470f9dd1f0873f805bf3e228fe26fca2ef1825bfd2abcdbca5706b791440c45242`; test SHA-256 `63d48e42e6ec805bf3e228fe26fca2ef1825bfd2abcdbca5706b791440c45242`.

## Commands and evidence

- `node --check scripts/v1-package-fixture.mjs`: exit 0.
- `node scripts/v1-package-fixture.mjs generate --output /Users/apple/Progame/DGOS/.herdr/state/package-fixture`: exit 0, signed and verified seven-capability official envelope; generated files have public readable permissions and their directory is 0700 on host. Container read-only mount can read as the configured user when ownership permits.
- `git check-ignore -v .herdr/state/package-fixture/ai-workbench-envelope.json`: matched `.herdr/.gitignore:state/`.
- `node --test tests/integration/app-package-fixture.test.mjs`: 1/1 pass. The first test attempt timed out because synchronous subprocess execution blocked its local HTTP server; changed to asynchronous subprocess and reran successfully.
- `git diff --check -- scripts/v1-package-fixture.mjs tests/integration/app-package-fixture.test.mjs`: exit 0.
- Lead mounted `/workspace/.herdr/state/package-fixture/trust-roots.json` and rebuilt API; D explicitly returned a short maintenance window. Read-only probes showed 15202 API and 15203 Web proxy both forwarded `/api/v1/identity/admin/session` to the API; seed used the requested 15203 public Web proxy.
- `DGOS_PACKAGE_FIXTURE_PRINCIPAL_ID=<redacted> DGOS_PACKAGE_FIXTURE_CREDENTIAL=<redacted> node scripts/v1-package-fixture.mjs seed --api-url http://127.0.0.1:15203/ --output /Users/apple/Progame/DGOS/.herdr/state/package-fixture`: exit 0. Public HTTP response reported `dgos.ai-workbench` version `1.0.0`, build `1`, stable, subject `c2fee94e-bd71-46b8-b1fa-79f75b736773`, deployment revision `1`, signed digest above. All seven grants returned `allow` with scope `*`: `dgos.model.list`, `dgos.model.resolve`, `dgos.aiTask.submit`, `dgos.aiTask.get`, `dgos.aiTask.events`, `dgos.aiTask.cancel`, `dgos.artifact.read`.
- Immediately after seed the API/DB maintenance window was returned to D. No further environment write requests were sent.

## Limits and handoff

- `seed` evidence establishes signed release submission, install/deployment and explicit broker grants through public HTTP. It does not establish model selection, iframe loading, Task completion, worker events, artifact read or cancellation. D owns the next real browser run with the already configured model and independent worker.
- Generated root is per run. Re-running `generate` would create a new keyId/envelope and requires Lead to update the mounted root and restart API before seeding. Keep the current generated assets stable for this browser batch.
- No production signing key, public upstream Provider, or release authorization is implied by this fixture.
- contract_changes_proposed: []
- open_risks: real browser/Task chain and temporary root operational scope; model/quota state was intentionally untouched.
- docs_to_update: Lead/Planner acceptance evidence after D's actual browser and worker results.
- incomplete_items: real signed package iframe Task/events/artifact end-to-end verification by D; no other r6 seed work pending.
- decisions_needed: []
