# V1-IMAGE-SECURITY r10 — Lead Docker read-only handoff

This is an addendum to `.herdr/V1-IMAGE-SECURITY-r10.md`. Its r9 scan identity, counts, hashes, runtime limits, and release-blocked status are unchanged. Worker-B did not run the commands below because its Docker socket is denied. Run them from the repository root in Lead's Docker-capable session and record command exit codes and output. These commands do not edit repository files, images, or packages; the APT refresh uses only disposable container tmpfs.

## 1. Bind the exact scanned image

```sh
image_ref=sha256:b13512c061722325d5bfdd0a7243dbdfc17688d3f94662a7d6bfddc47c1d282f
docker image inspect "$image_ref" --format 'ID={{.Id}} OS={{.Os}} ARCH={{.Architecture}} CREATED={{.Created}}'
docker run --pull=never --rm --read-only --network none --entrypoint sh "$image_ref" -ec 'cat /etc/os-release; node --version; id; dpkg-query -W -f="${Package}\t${Version}\t${Status}\n" libxml2 libllvm19 mesa-libgallium libgbm1 libexpat1 bsdutils util-linux perl-base libx11-6 libxrender1'
```

Stop if the inspected ID differs from the r9 JSON `Metadata.ImageID`, or if the image is absent. Do not silently substitute the tag or a new image.

## 2. Check candidate versions and simulated upgrade

```sh
docker run --pull=never --rm --read-only --user 0 --network bridge --tmpfs /var/lib/apt/lists:rw,size=256m --tmpfs /var/cache/apt:rw,size=64m --tmpfs /tmp:rw,size=64m --entrypoint sh "$image_ref" -ec 'apt-get update -qq; apt-cache policy libxml2 libllvm19 mesa-libgallium libgbm1 libexpat1 bsdutils util-linux perl-base libx11-6 libxrender1; apt-get -s upgrade'
```

This checks the current configured Debian trixie repositories at execution time. `Candidate` greater than `Installed` shows an available package upgrade; it does **not** prove a CVE is fixed. Compare any candidate source version with the relevant Debian security tracker or advisory before proposing remediation. Preserve the full `apt-get -s upgrade` output, including held and removed packages. APT fetch failure or stale indexes makes the candidate result inconclusive.

## 3. Confirm the required dependency chain

```sh
docker run --pull=never --rm --read-only --network none --entrypoint sh "$image_ref" -ec 'dpkg-query -W -f="${Package}\t${Version}\t${Status}\n" libgbm1 mesa-libgallium libllvm19 libxml2; apt-cache depends libgbm1; apt-cache depends mesa-libgallium; apt-cache depends libllvm19; apt-cache rdepends --installed libxml2'
```

These package declarations should be checked against the installed versions above. If a package name or edge changed in the current image, capture that exact result; do not purge a required browser/LLVM/XML library on the basis of the older r9 chain.

## 4. Evaluate a supported base without changing the image

```sh
docker manifest inspect node:22-trixie-slim >/dev/null
docker manifest inspect node:22-bookworm-slim >/dev/null
docker image inspect node:22-trixie-slim node:22-bookworm-slim --format '{{.RepoTags}} ID={{.Id}} OS={{.Os}} ARCH={{.Architecture}}' 2>&1
docker run --pull=never --rm --read-only --network none --entrypoint sh node:22-bookworm-slim -ec 'cat /etc/os-release; node --version; dpkg-query -W -f="${Package}\t${Version}\n" libxml2 libexpat1 bsdutils util-linux perl-base' 2>&1
```

The manifest checks establish whether official Node 22 tags resolve now. The last two commands only compare local images; `--pull=never` will fail if Bookworm is not cached. That failure is an explicit limit, not evidence about Bookworm package versions. Historical r7 Bookworm scan had more findings than r9 Trixie, so do not switch bases solely to remove one CVE; a rebuilt complete image would need its own scan and full runtime/security regression. Alpine is not a direct substitute for the current Debian/glibc Playwright Chromium and bubblewrap stack.

## Minimum supported remediation decision

1. If Debian trixie supplies a fixed candidate for a scanned CVE and the simulated upgrade preserves dependencies, rebuild from the supported Node 22 trixie base with that candidate; scan the exact new image and rerun API/worker, UID 1000 Chromium, Linux MCP and negative canaries.
2. If trixie has no fixed candidate for `libxml2` or another finding, retain the required library and the blocked gate. Do not mix unstable packages, remove the browser dependency, weaken seccomp/bubblewrap, or record a scanner exception as a fix.
3. Consider Bookworm only after obtaining real package versions, a complete candidate image scan, and equivalent runtime/security proof. The commands above are triage, not release acceptance.

Worker-B made no product changes and started no Docker resources in this follow-up. Write ownership remains stopped after this handoff.
