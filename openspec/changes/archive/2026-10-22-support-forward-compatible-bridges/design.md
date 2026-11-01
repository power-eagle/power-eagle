# Design

## Context

See proposal.md for motivation. Saucepan readiness currently matches only 0.10.x and sends every exception through the same recovery string. Local Agent providers only check --version exit status; discovery and generation can bypass that check. Eagle API availability already checks callable host capabilities. Plugin manifest versions describe separate declared contracts.

The published Saucepan 0.11.0 raw Windows x64 manager passed scripts/check-saucepan-host.mjs with SDK 0.2.0 and Node 16.17.1 in an outside-checkout disposable root: profile preview/registration, install, restart, failed replacement, concurrent reader protection and explicit removal. The local v0.10.0..v0.11.0 SDK diff adds managed setup/status and tagged self-update, leaving the used resource/profile interfaces intact. The installed public executable is now a shim: an empty custom root cannot route it to its managed binary. This is a fixture routing issue, not evidence that the SDK must change.

## Goals / Non-Goals

**Goals:** one pure compatibility decision reused across external CLI boundaries; read-only probes; precise errors; no eager native imports in browser code; verify production bundles on Node 16.

**Non-Goals:** changing plugin manifests/dependency ranges, upgrading SDK or Eagle, changing manager installation/routing/ownership, implementing the separate reusable Agent package extraction, or claiming that version acceptance guarantees a working protocol.

## Decisions

### Portable version policy helper

Add `src/lib/bridge-version.ts` with `checkBridgeVersion(version: string, policy: { major: number; minimum?: string }): 'invalid' | 'major' | 'minimum' | undefined`. The helper is pure, validates a bare semantic version, ignores metadata in comparison and uses semantic prerelease ordering against an optional minimum. It has no host imports, application names or filesystem effects. Another editor embedding a native formatter or language server can reuse it with its own policy.

Reuse installed semver 7.7.3 parse/lt APIs instead of implementing version parsing or using coercion, which can silently accept invalid output. Add the small adapter because a standard caret range restricts major-zero minor updates and normally excludes prereleases, conflicting with the user's explicit policy. Test domain-neutral invalid, minimum, metadata, prerelease, same-major and major-change examples before integrating callers.

CLI adapters retain output-envelope parsing and diagnostic wording. Saucepan extracts `saucepan <version>` and supplies major 0/minimum 0.10.0. Claude extracts `<version> (Claude Code)` and supplies major 2; Codex extracts `codex-cli <version>` and supplies major 0. Agent adapters have no new minimum because this repository has not established a protocol floor; actual protocol checks still apply. Existing Codex prereleases remain accepted. Numeric major zero deliberately has the same forward policy as other majors, unlike SemVer's stability convention.

### Probe each native operation boundary

Keep Saucepan startup probes limited to --version/--help; require whole command tokens. Assign recovery per layer (host, executable, version, command surface). Old protocols, malformed output and new majors stop before client creation; built-ins stay available.

Local providers reuse their bounded process runner for --version. Availability returns false for invocation failures and throws actionable version-policy errors for incompatible output (the Agent already catches and displays errors). Direct discovery and generation probe too, so prior availability cannot conceal an executable upgrade. Do not cache successful results or silently change providers. Eagle generation continues through its supplied callback and existing capability checks.

### Keep the public SDK and ownership boundary

No package.json or lockfile change. The fixture accepts a raw independently obtained manager through POWER_EAGLE_TEST_SAUCEPAN; document the shim/root distinction without teaching production code private manager paths. Extend acceptance to check readiness so it would detect the reported regression. Record hashes/version/runtime and distinguish this Node-host acceptance from existing real Eagle 0.10 acceptance.

## Risks / Trade-offs

- A same-major release can still break a command or protocol (especially 0.x) → retain capability and structured response validation, report the actual failure, and document assumed versus tested support.
- Checking Agent versions per operation adds a small process startup → use the existing 5-second timeout and avoid stale cached compatibility decisions.
- Major gates are newly enforced for Agent CLIs → specific errors request bridge review; no automatic fallback or installation changes.
- Strict known CLI envelopes might reject a future renamed product banner → report unrecognizable version output, with bounded diagnostics and an executable-selection recovery.

## Migration Plan

Build and ship the updated app/host bundles. No stored data migration, store setup, SDK update or binary replacement is required. Reverting this change restores the previous version policy without altering persisted state. Validate helper and bridge tests, the full regression suite/build, and the packaged SDK lifecycle against the official 0.11.0 raw manager under Node 16.17.1. Record real installed CLI readiness without running paid generation.
