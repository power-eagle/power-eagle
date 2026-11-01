# Proposal

## Why

The Saucepan bridge rejects the installed 0.11.0 release solely because it pins the executable to 0.10.x, then misleadingly suggests a missing Eagle host bridge. External bridge compatibility should survive minor and patch updates and require review at numeric major boundaries.

## What Changes

- Adopt a common forward-compatibility policy for versioned external bridges: accept the supported numeric major, subject to an established protocol minimum and real capability checks. This deliberately includes minor updates within major zero.
- Accept Saucepan >=0.10.0 and <1.0.0, ignoring build metadata; retain SDK 0.2.0 and its injected Node 16 transport, verified against the published 0.11.0 manager.
- Apply major-boundary checks to Claude (major 2) and Codex (major 0), preserving their existing prerelease use and protocol validation. Do not invent new minimum versions for these adapters.
- Distinguish unavailable host, missing executable, invalid/unsupported version and missing capability diagnostics. Preserve built-ins and provider isolation.
- Document tested releases separately from assumed compatible releases and make isolated SDK acceptance work with the raw manager rather than assuming a managed shim can route from an empty store.

## Capabilities

### New Capabilities

- `bridge-compatibility`: Forward compatibility, major-boundary review and failure reporting for external CLI and capability-based host bridges.

### Modified Capabilities

- `saucepan-integration`: Resource profiles use a compatible manager without an exact minor pin.
- `package-distribution`: Central-store bridge uses an explicit minimum and major boundary rather than 0.10-only compatibility.

## Impact

Changes affect the Saucepan readiness probe, local Agent provider probes and invocation guards, a small reusable semver policy helper, tests, validation harness and documentation. Existing semver supplies parsing/comparison; no SDK or dependency update is needed. Plugin manifest format versions and declared dependency ranges remain their own contracts. Other active Agent redesign/package extraction work is preserved.
