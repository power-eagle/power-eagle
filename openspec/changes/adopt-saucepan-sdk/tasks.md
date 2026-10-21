# Tasks

Checkpoint only coherent, verified slices. If replacing the SDK dependency breaks still-unconverted imports, complete the dependent adapter conversion before committing that slice; do not add legacy compatibility shims to manufacture an intermediate checkpoint. Keep active OpenSpec change files outside implementation commits and do not push without explicit authorization.

## 1. SDK and Eagle transport checkpoint

- [x] 1.1 Pin the reviewed SDK 0.1.0 package from upstream commit 041e4f90634e6007b58054a59604396f8fbebd21 and wire a bundled client with explicit host transport; verify reproducible package installation/build without a Git-subdirectory npm dependency or committed machine path.
- [x] 1.2 Implement the Eagle Transport boundary using public SDK contracts and existing host modules; verify literal argv, credentials/root/app options, payload closure/cleanup, limits, errors, mutation uncertainty, cancellation and byte streams with focused transport tests.
- [x] 1.3 Replace shared-executable probing with bounded 0.9 version/surface inspection; test missing/old executables, build suffixes, absent bridge and browser startup without store mutations.
- [ ] 1.4 Verify the bundled client and host transport on the declared Node16.17/Eagle boundary, plus Vite build/import isolation; record concrete host evidence and stop dependent integration if an upstream public-export/runtime blocker remains.
- [x] 1.5 Update setup guidance in docs/packages.md for the independent manager and injected host client; verify instructions and compatibility diagnostics against the implemented probe.

## 2. Current ownership and policy checkpoint

- [x] 2.1 Replace marker/token and old artifact models with UUID registration, explicit scope and app-domain bindings; test repeated registration, corrupt old state, distinct scopes, private default visibility and no keyring requirement.
- [x] 2.2 Register flat immutable policies and attach UUID references through current SDK operations; test explicit adoption, source restrictions, opt-in credentials/verification and denial without unbound fallback.
- [x] 2.3 Map Git/ref/commit/subpath, URL file/ZIP and local inputs to registered source requests and covered relative views; verify with isolated real-manager fixtures and update example payloads.
- [x] 2.4 Remove old configure/view/history/snapshot/mirror wire calls and update existing metadata callers to current operations (new workbench management controls remain in rebuild-power-eagle); run focused saucepan-client/package-repository tests and confirm unsupported legacy methods are absent from executable paths.

## 3. Retained package publication checkpoint

- [x] 3.1 Implement group preparation with expected revisions and generation pin receipts for persistent and preview acquisition; verify deduplication, exact output retention, restart discovery, scope separation and preview not becoming installed.
- [x] 3.2 Keep prior active pins through replacement validation and provider disposal; test failed validation/activation, concurrent reclamation, refresh conflicts and successful handover without deleting shared content.
- [x] 3.3 Cover workspace snapshots/duplication with source retention and preserve independent editable copies; test copying during reclaim and verify editing a clone never mutates an acquired output.
- [x] 3.4 Implement explicit preview/uninstall cleanup and uncertain-response reconciliation by original key/revision; test late readers, lost receipts and safe inspectable pin leaks, then document ownership and recovery.

## 4. Integration and spec reconciliation

- [x] 4.1 Reconcile obsolete Saucepan-specific package-distribution requirements in the pending rebuild-power-eagle change with this capability; review the resulting deltas without completing unrelated rebuild or spin-off tasks.
- [ ] 4.2 Run npm typecheck/build and the affected install/workspace/feature suites, then a packaged Eagle install -> restart -> refresh -> failed replacement -> remove flow against an isolated manager; record host/platform and any unavailable verification honestly.
- [x] 4.3 Verify the consumer package includes the reviewed SDK, runs outside its checkout and contains no legacy protocol transport or marker-state fallback; validate this OpenSpec change strictly before archive.

## 5. Profile contract upgrade checkpoint

- [x] 5.1 Pin published SDK 0.2.0 and manager 0.10 contracts; check release manifest/checksums and reject old or incomplete executable surfaces.
- [x] 5.2 Expose read-only profile preview and explicit catalog registration using Rust expansion, preserving explicit UUID attachment/adoption and independent scope/protection/pins; test default managed behavior, idempotence, stage overrides and retained refresh.
- [x] 5.3 Verify focused suites/build and the outside-checkout Node16 host harness against released artifacts; retain the separate real Eagle acceptance gap.
- [x] 5.4 Align the custom Eagle transport with profile-name array responses and profile/explanation field shapes; observe the failing profile-list regression, then pass focused transport checks and the released Node16 host harness.

## Profile release verification (2026-10-15)

- Published v0.10.0 SDK manifest identifies manager commit `8a2d04e7d2e393c035715520254bdd5955651873` and SDK 0.2.0. SDK tarball SHA256 `061281cf69b250281fe30cf9588e5411e40ac4fe026850c48eefca3af5fde581` matches the release manifest and SHA256SUMS; npm lockfile records its published URL and SHA512 integrity.
- `npm ci --ignore-scripts --no-audit --no-fund --allow-remote=all` installed the exact lockfile from published assets (npm12 disables remote tarballs by default). No unrelated dependency lock changes.
- Published Windows x64 manager (`saucepan 0.10.0+v0.10.0`) passed 45 install/transport/resource tests. Workspace/application workspace tests passed 27 checks. Production build including typecheck and host bundle passed; strict OpenSpec validation passed.
- Outside-checkout host bundle on Node16.17.1 passed explicit-update profile registration with acquisition overrides, install/restart/failed replacement/cross-window reader retention/reclaim/removal against the published manager.
- Follow-up transport regression initially failed on `profiles()` because the old custom transport expected object arrays. Profile-name arrays and required profile/explanation response shapes are now checked against SDK0.2; all13 transport/probe tests and typecheck passed, and the rebuilt Node16 host harness additionally verified released profile listing and explanations. Total focused coverage exercised is73 tests (46 install/transport/resource plus27 workspace).
- No manager auto-install, background update, profile inheritance or privilege fallback introduced. Existing real packaged Eagle acceptance tasks1.4/4.2 remain open; Windows Node harness results do not establish Eagle GUI or macOS/Linux runtime acceptance.

## Prior verification evidence

- Node 16.17.1 Windows x64: bundled public SDK client and Eagle transport ran against Saucepan 0.9.0 in an isolated root. The self-contained host bundle was copied outside the checkout for install, restart, invalid replacement after claim advancement, cross-window reader/reclaim and explicit removal checks (scripts/check-saucepan-host.mjs).
- npm typecheck/build passed. The affected install/workspace/feature suites passed 112 tests, plus the subsequently added targeted preparation-conflict and covered-parent-claim tests passed (114 covered tests). Current integration fixtures cover Git commit/ref/subpath, URL ZIP/raw, local copies, credential opt-in, path verification policy opt-in, scoped denial, lost receipts, pin retention and claim/group cleanup.
- Both this change and the reconciled rebuild-power-eagle delta pass strict OpenSpec validation.
- Tasks1.4 and4.2 remain open: actual packaged Eagle execution was not performed. The revised workbench has no acquisition-management UI; wiring it remains in rebuild-power-eagle. A Node16 subprocess harness does not establish Eagle GUI acceptance.
