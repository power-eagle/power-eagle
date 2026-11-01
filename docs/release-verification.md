# Release assembly and verification

Run `npm run release:build` after `npm ci`. It builds the current application and
emits `.artifacts/releases/power-eagle-6.0.2.eagleplugin` plus a JSON report with
the archive SHA256, per-file hashes and an external extracted inspection directory.
`npm run release:test` checks archive round-trip/reproducibility and rejects
escaping paths, source/dependency files, missing assets, remote page assets,
escaped built-in entries and stale extra JavaScript bundles.

The archive contains only root `manifest.json`, `logo.png`, `_locales` and `dist`,
including the CommonJS host entry, seven built-ins, local media, fonts and licenses.
It preserves the existing manifest version and `dist/index.html` entry. Neither
the source checkout nor node_modules is required to inspect its extracted files.
No release is uploaded or published by this command.

ZIP packaging with an `.eagleplugin` suffix follows this repository's previous
release script and its allowlist, without restoring template-sync workflows.
Eagle also offers [Pack Plugin in its plugin panel](https://developer.eagle.cool/plugin-api/publishing/package.md).
Archive inspection is **not** proof of installation: the actual archive still
needs the isolated real-Eagle checks below. The ZIP library is a build-only
dependency and is not added to the application bundle.

## Verification on 2026-10-31

The archive contains 50 files (1,001,235 bytes), with SHA256
`7af1c3ff4a3719873d44bb993a076174a7f134ff7e12a253acf5c53791491573`.
The generated `.artifacts/releases` reports retain per-file hashes and the
external extraction path. The four release tests passed, including deterministic
round-trip and rejection cases.

`npm run release:clean` copied 449 inventoried files to a fresh temporary root,
cleared `NODE_PATH`, and ran all seven commands successfully using independent
dependencies: `npm ci`, `release:build`, `release:test`, `packages:test`, `test`,
`typecheck`, and `lint`. The source hashes, command arguments, exit codes and
individual log paths are in `.artifacts/releases/clean-verification.json`.
The initial clean run used Windows x64 Node 26.12.1: 49 package tests, 362 app/BDD
checks and four release tests passed; 19 opt-in manager tests were skipped.
This establishes the recorded source snapshot, not Eagle's Node 16 runtime.
The catalog-audit script and two package-controls tests were added afterward
and verified separately; no application runtime code changed afterward.

The three workbench BDD scenarios contain 13 steps covering retained selection,
keyboard inspection/return without enabling the inspected plugin, and required
export failure/recovery across a reopened catalog. Production files extracted
outside the checkout were inspected in Zen at normal width and 490 × 818 CSS
pixels. Blueprint and Paper Pop controls, local typography, keyboard focus and
collapsed panel rails remained legible, with no observed horizontal overflow.
Changing theme retained Runtime flow's Count 1. This browser inspection does not
establish native Eagle menus, host APIs or complete screen-reader accessibility.

### Acquisition coverage

| Criterion | Current evidence | Remaining boundary |
| --- | --- | --- |
| Sources footer and explicit setup | `PackageControls` plus UI tests; October 21 Eagle report observed Add package and setup without initialization | Current release installation is still pending |
| Persistent/session distinction | Installed revision and Session preview labels; mutually appropriate refresh/remove/close controls tested | Native rendering of current release pending |
| Progress, success and failure | Keyboard submission test observes progress, disabled controls and completion; refresh failure surfaces an alert | No fabricated per-download substage telemetry; manager API exposes whole operations |
| Scoped refresh and retained state | Selected installation ID asserted; real manager tests reject invalid candidates and separately selected revisions, restore activation, and permit a later successful refresh | Actual release reload pending |
| Independent/shared data protection | Real tests preserve source and independent copies on removal; uncertain publication/disposal retains receipts and retention | Renderer termination remains best-effort cleanup |
| Keyboard access | Form Tab/Enter submission and duplicate-operation prevention; workbench BDD Shift+F10/Escape and focus return | Native package footer traversal in Eagle pending |

All 19 opt-in tests in `saucepan-client.test.ts` and
`workbench-acquisition.test.ts` passed against the installed **real manager
executable**, Saucepan `0.11.0+v0.11.0`, with fresh isolated manager/state/source
roots. Initially 18 failed when the launcher shim was supplied: its handling of
an explicit isolated `--root` returned `saucepan-shim: ... file ... not found`
before launching the manager. The same manager directly passes; the production
transport was not relaxed or changed. For isolated tests, point
`POWER_EAGLE_TEST_SAUCEPAN` to the installed store's manager executable, not
`~/.saucepan/bin/saucepan.exe`. No shared store was initialized or modified.
The [historical Eagle report](saucepan-host-validation.md) remains separate
evidence for its October 21 build and runtime.

### Catalog and baseline capability audit

`npm run release:catalog-audit` maps all **75** published widgets to schema
properties/defaults/slots/events/theme hooks, runnable examples, documentation
and focused behavior suites. Its JSON report records the referenced test hashes.
The clean suite validates and renders every published runnable example and
checks that published catalog JSON matches the generated catalog. Families cover
layout, safe content, forms, selections, desktop controls, collections,
virtualization, feedback, media and Eagle operations. Passive wrappers such as
Card, Divider and SelectableText have rendered-example coverage; this inventory
does not claim an independent interactive test for every passive widget.

| Original capability | Evidence in current source and passing suites | Remaining acceptance |
| --- | --- | --- |
| Declarative language | `sdui/schema`, state, actions, navigation and runtime tests; `docs/language.md` | Real-host integration of release |
| Widget catalog | 75-entry audit; catalog and family suites; `docs/widget-catalog.md` and published contracts | Native appearance/host operations where relevant |
| Contribution packages | Contribution/package repository tests, provider probing with relocated private versions and shared React, installed-widget/package-example tests | Installed runtime-only/provider-only/mixed release matrix |
| Contribution activation | Dependency graph, enablement, controller, styling and app recovery tests | Native revocation/recovery and ownership handoff |
| Package distribution | Release archive tests, clean dependency build, real Saucepan lifecycle/receipt tests | Install the actual archive in Eagle |
| Workbench shell | Selection, layout, theme, activation, workspace and BDD suites; production visual checks above | Native original/copy menu order and reload |
| AI authoring | Authoring validation, immutable workspace revisions, Agent/controller/context/provider tests and external packed consumers | Active Agent live gates and deferred authoring consistency design |
| Eagle tooling | Host capability/selection/API tests and built-in tools/clipboard suites; packaged assets | Current release's useful tools in the actual Eagle host |

Legacy package/workspace formats are explicitly rejected in package-repository
and workspace tests. State-reset tests remove owned legacy locations, preserve
shared/external locations and new-format state, and reject unexpected roots or
corrupt sentinels. Store tests preserve external originals and independent
provider-only copies. These checks do not authorize deleting live user state.
The active Agent redesign changes old failed-turn behavior; its pending delta
must be reconciled before archive rather than reinstating obsolete deletion UI.

## Incremental checkpoint verification on 2026-11-01

The staged bridge candidate was exported outside the checkout, installed with
`npm ci`, and passed 46 helper/transport tests, typecheck and host build. The
separate library candidate passed a fresh dependency installation, both package
builds, all 49 package tests and application typecheck. The Agent integration
candidate passed 349 app tests (19 opt-in tests skipped), production build and
lint. The completed bridge archive's five delta requirements matched the main
specs, and the bridge specification passed strict validation.

The release candidate was exported to another fresh directory and passed
`npm ci`, production release build, four archive tests, the 75-widget audit,
19 workbench BDD/package-controls checks and lint. These candidates excluded
active OpenSpec planning and the separate manifest localization edit. Each
commit message passed computed zmem validation, with staged review and an index
eligibility check immediately before commit. This adds verification of the
individual commit boundaries; it does not satisfy the live acceptance below.

## Pending real Eagle acceptance

- Install the actual archive in Eagle with isolated state; exercise runtime,
  provider and mixed/private-dependency packages, revocation/recovery and built-ins.
- Verify native original/copy ordering, ownership handoff and persisted reload.

The Agent package and original redesign keep their own live acceptance gates.
Do not treat a synthetic provider result or a copied-source fixture as an
authenticated model result or installation of this release archive.
