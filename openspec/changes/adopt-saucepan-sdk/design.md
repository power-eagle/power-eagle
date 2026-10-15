# Design

## Context

See proposal.md. Inspected branch `revised`: `saucepan.ts` implements temporary payload files and execFile; `saucepan-client.ts` owns marker tokens, settings, history/snapshot/mirror and old artifact models; `saucepan-manager.ts` probes the removed shared-executable command. `package-repository.ts` retains validated packages on failed refresh. `workspaces/store.ts` already snapshots editable copies and publishes a validated catalog. `docs/packages.md` records Eagle 4.0.0 Windows x64 with Node 16.17.1. Browser preview lacks the native bridge.

Current upstream target is Saucepan commit `8a2d04e7d2e393c035715520254bdd5955651873` (v0.10.0), SDK 0.2.0. Read `sdk/ts`, `docs/policy-profiles.md`, resource group and output pin contracts. Prior 0.9 acceptance remains historical evidence; the profile upgrade requires released 0.10 acceptance separately.

## Goals / Non-Goals

**Goals:** retain package UX and immutable content lifetimes while replacing the wire boundary with the supported SDK; keep protocol decisions in Rust and Eagle lifecycle in the host.
**Non-Goals:** no Node upgrade requirement imposed on Eagle, private manager download, old schema compatibility, shared-store migration, new service framework, or redesign of local editable workspace copies.

## Decisions

### Package and runtime boundary

Use the published `saucepan-sdk` 0.2.0 tarball from the pinned v0.10.0 commit (reviewed source pack only for provisional local work). Verify release manifest/checksums and record npm integrity in the lockfile; never use an npm Git subdirectory URL or a machine-specific absolute dependency in the committed manifest. Keep npm and existing build tooling.

Bundle the transport-independent client entry and public contract/error exports into the host build. Inject an Eagle transport using the existing `resolveHostRequire` boundary. Do not import the NodeTransport implementation or deep-import private SDK files. SDK metadata advertises Node >=22: host compatibility is an explicit acceptance gate, not inferred from TypeScript compilation. Verify the actual bundled client on Node 16.17/Eagle and prove default transport is not executed or required by the host bundle. If current public exports prevent that, report the minimal upstream SDK blocker rather than vendoring or restoring the old client. Node22 test success alone is insufficient.

A custom transport is needed because default Node built-in loading does not use Eagle's CommonJS bridge. Preserve Config/Call/Payload/Transport contracts: literal argv, --error-format json, optional root/app/credential-file/policies, closed private payload files, input/output bounds including group limits, timeout and AbortSignal, byte-preserving runs, structured domain errors and indeterminate mutation status. Implement only host I/O and wire framing; do not implement source selection or policy evaluation. Existing fs/process helpers are reused where possible; no Execa, native bindings or second validation schema.

### Executable, ownership and policies

Resolve an explicit executable or the established user `~/.saucepan/bin/saucepan[.exe]` path in app-owned configuration. Use a bounded version/command-surface probe. Require the tested 0.10 contract including profile commands and build suffixes; reject earlier managers before mutation. Startup is read-only and built-ins remain usable on failure. Store init is a distinct deliberate action; never reset an existing root.

Persistent installation opts into a registered `power-eagle` app via registration_key, saves its returned UUID, and uses a literal installation scope (initially `library`; separate explicit workspace scopes when selected). Scope is application ownership, not credentials. Default credentials_required is false; keyring and verification are separate opt-ins. New state stores UUIDs/receipts, never token bytes. Protected sessions stay bound on error and never retry as local admin.

Register immutable policies once and retain their UUIDs; changed policy definitions get new UUIDs and explicit adoption. Persist only policy_refs on app/claim/group intent. Separate retrieval refresh, acquisition update, revision retention, reclaim recovery and pin retention. Default source and claim visibility do not widen because credentials are absent.

Expose `previewProfile` as a root-free manager call and `registerProfile` as explicit local catalog registration. Registration returns manager-owned flat references for the caller to attach, never adopts them implicitly. Default profile selection is `managed`; `explicit-update` changes retrieval freshness only, so updating existing acquisitions requires an explicit update-stage override. Do not copy built-in recipes into Eagle. No `forInstall` is exposed on this resource helper: package loading does not install an executable. Previewing `temporary` remains possible, while retained package registration is limited to managed resource profiles; temporary retrieval belongs to the direct SDK lifetime APIs. Existing manual policy registration and omitted-profile semantics remain available.

### Acquisition and retained outputs

Map Git origin to source registration plus ref/commit selector; URL format/name and local copied-folder selection remain supported. Use current source_uuid, selector, selection and policy_refs rather than a fabricated legacy recipe. Preserve optional subpaths and the manager's covered-claim relative view, not just the parent entry root.

Persistent slots are keyed by installation scope and intended source/selection; an authored display alias is local UI metadata. Register an app-owned group with acquire intent and explicit claim scope. Use prepareGroup(expectedRevision, pin) so candidate output selection and pin receipt commit together. Pin keys identify an operation/generation, not just a source. Reconcile timeout by the original key/revision before any new attempt; never automatically retry a mutation under a fresh key.

Session preview uses an unbound local group without claims and an explicit preview pin. This retains files but does not create an app installation; release its pin when preview/copy finishes. A no-store preview, if exposed later, must use a caller-owned directory or guarded run and is not silently substituted here.

Consume only returned paths under a confirmed live pin. Static package discovery runs before provider code. Publish the new active package/catalog only after validation; retain the previous pin on failed acquisition, validation or activation. Keep exact prior outputs pinned until provider disposal and all runtime readers finish. Durable reader markers are registered in the shared app-owned receipt file under its existing transaction lock before any file read. Disposal marks retirement, prevents new readers and defers pin release until every persisted handle closes. Crashed markers never expire automatically. This coordinates windows using the same state root; copying receipts between independent roots is unsupported. Do not mint replacement pins for historical outputs: the current manager requires a currently owned claim to create a new bound output pin, even when an older output already has a retained receipt. Releasing a claim or group registration is not equivalent to unpinning. Never remove payload directories directly.

Keep `workspaces/store.ts` ownership of independent copies for editing and duplication. A source pin covers snapshotArtifact through successful copy publication; a completely self-contained copied revision no longer depends on the central path. Immutable acquired paths never become editing destinations.

### Integration and reconciliation

Replace legacy SDK-shaped public adapter results with app-domain package records containing source/output/claim/group/pin identity and source revision. Update UI, tests, examples and docs together; do not emulate view/history/snapshot/mirror through compatibility methods. Exact-version selection uses a commit selector; copying uses the existing workspace copy boundary under a pin. Any previously exposed control must gain its current operation or an explicit unavailable state, never a silent no-op.

Before archival reconcile the three obsolete Saucepan-specific requirements in the pending `rebuild-power-eagle/specs/package-distribution/spec.md` (bridge, scope and recipe identity) with this capability. Preserve installation validation and release packaging. Do not mark either pre-existing change complete or undo spin-off work.

## Risks / Trade-offs

- [Node16 host versus SDK engines] → first checkpoint verifies the public injected-transport bundle; keep real Eagle evidence separate from Node simulation.
- [Crash leaves pins] → retain safe leaks and inspect owner/key receipts on recovery; do not use process-ID guessing to release another reader.
- [Candidate selected centrally before host validation] → host activation remains independent; keep prior active output pinned until successful publication.
- [Concurrent package edits] → use group expected revisions and existing workspace transactions, with explicit conflict diagnostics.
- [Release asset unavailable] → use an exact source-built tarball for isolated tests; shipping waits for a resolvable reviewed package reference.
- [Pending spec overlap] → reconcile owners before archive; no implied completion of the broader rebuild.

## Migration Plan

1. Establish SDK artifact/protocol contract and host transport conformance with isolated fixtures.
2. Replace persistent registration, policy and acquisition models with current UUID state. Old marker/state is diagnosed; do not convert or delete the shared store.
3. Wire pinned activation, preview, copies and unload cleanup; preserve old usable runtime state on failures.
4. Run focused host tests, real-manager fixtures, build checks and a packaged Eagle smoke test; document exact tested host.
5. Release the consumer only after its SDK artifact is obtainable. Rollback is a consumer build rollback with separate state backup; no in-process dual protocol and no destructive shared-root rollback.

## Implementation evidence and remaining acceptance

The release SDK tarball is available and its manifest confirms commit 041e4f90634e6007b58054a59604396f8fbebd21. Actual Node 16.17.1 runs of the bundled host entry, copied outside the checkout, cover install, restart, failed replacement after claim advancement, cross-window readers/reclaim and explicit removal. The pre-existing revised workbench has no acquisition-management controls; this change supplies a bundled integration API. Real packaged Eagle acceptance and that rebuild-owned UI plumbing are not established by the host harness.
