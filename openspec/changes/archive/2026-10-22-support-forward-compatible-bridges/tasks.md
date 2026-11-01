# Tasks

## 1. Shared compatibility mechanics

- [x] 1.1 Implement the pure semver compatibility helper and its documented contract; verify domain-neutral tests for minor/patch upgrades, major zero, metadata, prereleases, minimums and invalid versions.

## 2. Saucepan readiness

- [x] 2.1 Apply the minimum/major policy and layer-specific recovery to Saucepan; update package guidance and old-token recovery text; verify readiness tests cover 0.11, future 0.x, rejected major/old/malformed versions, missing commands and absent host/executable without mutations.

## 3. Local Agent bridges

- [x] 3.1 Apply shared compatibility checks to Claude/Codex availability, discovery and generation; document supported majors; verify upgraded/prerelease versions, major changes after availability, malformed versions, cleanup and unchanged Eagle delegation with provider boundary tests.

## 4. Packaged integration acceptance

- [x] 4.1 Extend the disposable SDK harness to assert readiness and clarify raw-manager setup; rebuild production artifacts, run the full regression suite and OpenSpec strict validation, verify the final SDK lifecycle on Node 16.17.1 with Saucepan 0.11.0 and installed CLI readiness, and record reproducible evidence and the SDK decision.
