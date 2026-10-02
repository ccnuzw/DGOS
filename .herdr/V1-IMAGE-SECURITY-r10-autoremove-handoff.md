# V1-IMAGE-SECURITY r10 — autoremove triage addendum

Lead ran a real disposable Docker container APT update/policy/simulated upgrade on `dgos-image-r9-local:latest` and reported exit 0: trixie candidates for `libxml2`, `libexpat1`, `libsystemd0`, `libudev1`, `mount`, and `libgbm1` equal their installed versions; `0 upgraded`. This is Lead's result, not a Worker-B command result. The original r10 report and r9 scan remain intact.

Worker-B crossed Lead's 18 autoremove names against all `Results[].Vulnerabilities[].PkgName` in `deployment/V1-IMAGE-SECURITY-r9-trivy-full.json` using Node; command exit 0, **0 matching findings out of 60**. Therefore removing exactly these packages cannot be claimed to fix any of the scanned 1 CRITICAL / 59 HIGH package findings. It may reduce unused image contents, but browser library use must be checked in the actual container. Do not modify `deployment/Dockerfile` based on APT's automatic flag alone.

Lead can run the following **once** from the repository root. It creates only one `--rm` disposable container, with no host mounts and no network. The command first requires the r9 image ID, then compares the simulated purge set to exactly the 18 names before allowing a real purge inside that disposable container. It checks that key libraries remain and launches Playwright Chromium as UID 1000. A set mismatch or smoke failure exits nonzero. Capture the full output and exit code; no image or repository file is altered.

```sh
docker image inspect sha256:b13512c061722325d5bfdd0a7243dbdfc17688d3f94662a7d6bfddc47c1d282f --format '{{.Id}}'
docker run --pull=never --rm --network none --user root --entrypoint sh sha256:b13512c061722325d5bfdd0a7243dbdfc17688d3f94662a7d6bfddc47c1d282f -ec '
  expected="libgl1 libgl1-mesa-dri libglvnd0 libglx-mesa0 libglx0 libice6 libsm6 libunwind8 libvulkan1 libxaw7 libxcb-glx0 libxfont2 libxkbfile1 libxmu6 libxpm4 libxt6t64 libxxf86vm1 x11-xkb-utils"
  planned=$(apt-get -s autoremove --purge | awk '\''$1 == "Remv" || $1 == "Purg" { print $2 }'\'' | sort)
  wanted=$(printf "%s\n" $expected | sort)
  printf "planned packages:\n%s\n" "$planned"
  test "$planned" = "$wanted"
  apt-get autoremove --purge -y
  dpkg-query -W libxml2 libllvm19 mesa-libgallium libgbm1 libexpat1 bubblewrap
  runuser -u node -- node -e '\''const { chromium } = require("@playwright/test"); (async () => { const browser = await chromium.launch({headless:true}); const page = await browser.newPage(); await page.setContent("<title>DGOS Chromium</title>"); console.log(JSON.stringify({uid:process.getuid(),version:browser.version(),title:await page.title()})); await browser.close(); })().catch(error => { console.error(error); process.exitCode = 1; });'\''
'
```

The full image ID binds both commands to the persisted r9 scan; `--pull=never` avoids registry activity. The disposable purge mutates only the container writable layer and is discarded by `--rm`. If APT reports a different removal set, the command stops before purge. A successful Chromium smoke supports runtime compatibility for this cleanup on Docker Desktop only; it does not prove API/worker or Linux MCP behavior, and no new final-image scan exists.

Minimum decision: do not add `apt-get autoremove` to the production Dockerfile for CVE remediation. Consider it only as image-size cleanup after the exact-set and browser checks, plus full API/worker/MCP regression on a newly built candidate. Security release remains blocked at 1 CRITICAL / 59 HIGH until a supported fix and exact final-image rescan or the authorized security disposition under the unchanged gate.

Worker-B performed no Docker operation, no product write, and no privilege escalation in this follow-up; write ownership is stopped after this addendum.
