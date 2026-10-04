# Design

## Context

See `proposal.md` for motivation and capability scope. The target retains React/Vite/TypeScript configuration and the Eagle manifest, but most tracked application files are already deleted. Those deletions are existing user work, not a request to restore the old application wholesale. No existing OpenSpec capabilities constrain the new language.

The reference app has six core widgets, executable `definePlugin` definitions, mutually exclusive kinds, a browser `file:` module importer, and a separate Node `require` bridge. Its current code and BDD features already support installed service/styling contributors and versioned AI conversations; some README statements are stale. The design scaffold supplies browser demo components and full-color CSS tokens, not production modules or font files.

### Evidence

- Source: sibling `power-eagle` commit `2f3accf`, especially `src/sdui/activate.ts`, `src/sdui/render/render.tsx`, `src/app/host-service.ts`, `src/host/install/{disk-plugin,fs-bridge,saucepan}.ts`, `src/ai/{converse,conversation-store,prompt}.ts`, and associated features/tests.
- Layout: `docs/authoring-extensions.md`, `.github/configs/pkgRules.json`, and root Eagle `manifest.json` in the source.
- Visuals: sibling `power-eagle-design-system/{README.md,shell-layout.md,tokens.css,components/index.d.ts}` and component documentation. Shell assets and typography must be packaged locally.
- Stac: [DSL](https://docs.stac.dev/dsl), [registry](https://docs.stac.dev/concepts/stac_registry), [custom widgets](https://docs.stac.dev/concepts/custom_widgets), [custom actions](https://docs.stac.dev/concepts/custom_actions), and [catalog index](https://docs.stac.dev/llms.txt).
- Hosting: [Eagle third-party modules](https://developer.eagle.cool/plugin-api/tutorial/3rd-modules), [Electron renderer ESM](https://www.electronjs.org/docs/latest/tutorial/esm), [Node createRequire](https://nodejs.org/api/module.html#modulecreaterequirefilename), [shared React](https://react.dev/warnings/invalid-hook-call-warning), and [native module compatibility](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules).

Documentation establishes feasibility, not successful execution in the installed Eagle build. No in-Eagle loader experiment has been run during planning.

## Goals / Non-Goals

**Goals:**

- Preserve existing source responsibilities while replacing the legacy storage/distribution organization and all authoring/runtime contracts.
- Separate serializable UI descriptions from compiled implementations, following Stac's model/registry/parser/action separation. Supply typed authoring and reusable components without exposing React internals in runtime JSON.
- Make contribution ownership, dependency resolution, disabled exports, and teardown observable and deterministic.
- Give built-ins, installed packages, and generated documents the same validation and activation semantics.

**Non-Goals:**

- Compatibility with the old v2 or v3 language, old executable AI payloads, or old manifests; automatic conversion and compatibility fallback are excluded.
- Dart/Flutter execution, byte-for-byte Stac JSON compatibility, or Stac Cloud integration. The language applies the architecture in Eagle's web runtime and uses the supplied visual language rather than copying Material styling.
- Claiming arbitrary npm/native modules work on every Eagle version; compiling native addons inside the workbench; a new package manager or mandatory monorepo.
- Automatic AI generation/build/installation of new executable provider code in the initial Agent flow. Installed custom providers are fully usable by generated documents; provider authoring remains a normal package build.

## Decisions

### 1. Preserve source boundaries and reset legacy data

Retain these ownership boundaries; add focused subdirectories rather than flattening or moving everything into a new `packages/` workspace:

| Location | Responsibility after rebuild |
| --- | --- |
| `src/app` | Shell orchestration, selection, package summaries, Eagle adapters |
| `src/sdui` | Language models/schemas, authoring exports, registry, actions, state, renderer, catalog |
| `src/host/install` | Saucepan, package paths, Node loading, filesystem and release compatibility |
| `src/plugins` | New-format built-in packages and Eagle tools |
| `src/ai` | Model bridge, schema-aware prompts, conversations and document versions |
| `src/components/ui` | Production design-system components |
| `docs`, `examples`, `features` | Public authoring contracts, installable examples, BDD scenarios |

On the first revised launch, resolve the exact legacy root as `<home>/.powereagle`, reject unsafe or unexpected deletion targets, remove that Power Eagle-owned tree recursively, remove obsolete Power Eagle browser-storage keys, and recreate the root with a versioned new-format sentinel. The sentinel makes the reset idempotent so later launches retain new data. The reset includes legacy conversations, theme state, cached binaries, workspace configuration/indexes, managed clones, and generated package data inside the legacy root. It never removes an external local source referenced by the old app and never removes the shared user-level `~/.saucepan` store, which may serve other applications. Tests use injected temporary home/storage roots and never exercise deletion against live user data.

Store new Power Eagle-owned state under the sentinel-marked `~/.powereagle` root with explicit format identities. New conversations and generated packages start empty; no legacy record is inspected, converted, or retained. Source acquisition uses Saucepan's current shared central store at `~/.saucepan`; its executable defaults to `~/.saucepan/bin/saucepan[.exe]` with an explicit path override.

Alternative: preserve or migrate legacy Power Eagle storage. Rejected because the requested clean break includes deletion of all data owned inside the old root. Deleting `~/.saucepan` or referenced external directories is also rejected because those locations are not exclusively owned by Power Eagle.

### 2. One new document language with typed authoring

Choose a distinct format identity (`power-eagle/runtime`, version `1`) and a separate package identity (`power-eagle/package`, version `1`). Version 1 names the new language, not an earlier implementation generation. Authoring helpers build typed serializable models and emit canonical JSON; code contributions compile separately. Reusable components accept typed inputs/slots and lower into the same model. SDK build tooling belongs alongside `src/sdui` and repository scripts, not in an unrelated workspace.

`run.json` defines initial state, named screens/components, a start screen, named action descriptions, and dependency references. Nodes use `type`, optional stable `key`, typed properties, declared child slots, and declared event actions. Exact property names are established by the published schema and examples, with one representation per concept. Unsupported formats fail before provider code is evaluated.

Bindings use tagged data references and expression nodes, not JavaScript source strings or executable closures. Preserve value types when resolving state, component inputs, item context, event payloads, and action results. Support property lookup, boolean/comparison/arithmetic operations, conditionals, collection transforms, and string formatting as documented operators. There is no arbitrary `eval`. Each view/component instance owns local state; shared state is reached through named providers.

Actions cover state updates, conditions, sequential/parallel composition, registered action/service invocation, requests, navigation, forms, and user feedback. Async results use explicit success/error paths and scoped result bindings. Dispose/cancel a view scope on replacement; late results cannot write into a replacement scope. Rendering reads state and does not perform host actions.

Alternative: serialize the old function-heavy widget tree. Rejected because closures are not a stable document format and would keep the old execution model.

### 3. Optional manifest-declared contributions

Recommended package shape (paths are declarations, not magic filename discovery):

```text
my-plugin/
  manifest.json
  run.json
  types.cjs
  styling.cjs
  actions.cjs
  services.cjs
  assets/
  node_modules/
```

All contribution files are optional; at least one declared contribution is required. The manifest keeps name/version/description for distribution and adds the new format, package id, host SDK range, contribution entries, named export descriptors, and explicit export dependencies. `contributions.runtime`, `.widgets`, `.styling`, `.actions`, and `.services` reference paths relative to the package root. The same package can provide any combination. One entry can provide multiple named exports. `types.cjs` means widget definitions/implementations, not TypeScript declaration files.

Exports have package-qualified identities and kind-specific schemas. Static manifest descriptors allow discovery without running provider code; activation must verify that compiled exports match those descriptors. Dependencies specify provider package/version range, export kind, and export id. npm dependencies remain a separate package-local concern and do not automatically become public Power Eagle exports.

Resolve declared paths and assets relative to the package root; reject missing entries, escaping paths, and mismatched manifests with package-specific diagnostics. Runtime documents can reference packaged assets without relying on the host working directory. CSS, fonts, workers, and other library assets must be listed/copied by the package build rather than assuming a bundler dev server.

Alternative: mandatory `run.json` or one executable entry per package. Rejected because library-only, styling-only, and mixed packages are first-class use cases.

### 4. Compiled providers with package-local dependencies

Compile provider TypeScript/TSX to CommonJS for the initial package target. Bundle ESM-only dependencies into compatible provider output where needed; ship remaining production dependencies in a self-contained `node_modules` tree. Installed packages do not depend on the author's package-manager cache, workspace symlinks, or a runtime `npm install`.

The candidate loader obtains Node module facilities through Eagle's bridge, anchors `createRequire` to the package, and loads explicit `.cjs` entries. Browser `import()` is not the npm dependency resolver. SDK registration receives the host React/renderer contract and lifecycle context. The SDK/build contract must route React, ReactDOM, and JSX-runtime use (including transitive UI dependencies) to the host instances, rather than letting packages render into the host with duplicate React. Use a factory/SDK adapter and build-time external mapping; do not patch global Node resolution as the default design.

Native addons need an explicitly supported runtime/OS/architecture build. Record the runtime actually tested, not an assumed version from old docs. Native portability and ESM-only package behavior must be reported honestly; an unsupported package fails visibly rather than invoking a legacy loader.

**First implementation checkpoint:** a disposable example in the revised repository loads a dependency from its own `node_modules`, registers a hook-using widget with host React, renders JSON using it, loads its asset, and disposes it. A second package uses a different dependency version to check resolution isolation. Exercise disable/re-enable and controlled reload without stale Node module-cache behavior. Run in actual Eagle and record its runtime/build and results. Node tests supplement but cannot replace this evidence. If the bridge/shared-runtime contract fails, stop dependent loader integration and revise this design; do not substitute unverified claims or legacy fallback.

Alternative: all providers compiled into Power Eagle. Rejected because installed packages must be able to add implementations. Fully bundled providers alone also do not meet the requested optional `node_modules` model.

### 4a. Current Saucepan central-store integration

Target Saucepan 0.6's declarative recipe and central-store protocol rather than the removed workspace/TOML/bucket commands. Power Eagle calls the independently installed executable directly with argument arrays and temporary JSON request files through Eagle's injected Node bridge. It does not import the upstream TypeScript SDK at runtime because that SDK requires Node 20 while the verified Eagle host provides Node 16.17.1. The adapter must remain asynchronous, avoid a shell, preserve structured stdout/stderr diagnostics, clean temporary files, and let built-ins operate when Saucepan is absent or its store is unavailable.

Use a registered `power-eagle` app and stable marker for durable package acquisition, filtered views, artifact path resolution, history, and configuration. Also support acquisition with all caller flags omitted. That unscoped path is appropriate for session-only preview or validation: it returns the acquired artifact and directory without registering an app or adding a touch to Power Eagle's persistent view. Because `view`, `path`, `history`, `snapshot`, `mirror`, `configure`, and `verify` remain app-scoped, anything expected to reappear in Sources after restart must use the scoped path.

Read source grouping from the acquired/view artifact's canonical `source_id` and full `source` descriptor. Git, URL, and local recipes share the same flow; current Saucepan copies local inputs into central storage, so Power Eagle must not assume local packages remain in place. Never read or rewrite `index.json.enc` directly, reconstruct central content paths, or add a second package index. Production encryption and credentials remain Saucepan concerns; Power Eagle adds no separate encryption layer and does not treat scoping as mandatory for every acquisition.

Alternative: bundle the Node 20 SDK or preserve the old binary downloader and `saucepan.toml` workspace. Rejected because neither matches the verified Eagle runtime or current Saucepan protocol.

### 5. Transactional registries and explicit enablement

Load module descriptors, validate named exports/dependencies, determine a topological activation order, then activate providers and publish a coherent registry snapshot. Top-level module loading and registration must be declarative; side effects belong to activation hooks that return disposers. Reject dependency cycles and duplicate qualified identities; never select a winner by incidental directory order. Unrelated packages continue operating when one package fails.

Keep desired enablement separately from effective availability. Package disablement suppresses all its exports but preserves individual preferences. Export disablement revokes future access and reconciles affected consumers. A consumer with a missing required export has `failed` status with a dependency reason; a user-disabled export is `off`. Re-enable in dependency order when requirements become available. Previously obtained service handles must not keep invoking a disabled provider; use revocable host-mediated handles. Stage selection is not activation: services persist until their activation scope ends, while view-local resources end when a view is replaced.

`used by` displays declared direct consumers, including inactive consumers, with their status. It is not a count of observed function calls. Deactivation runs dependents before providers; package update invalidates only that package's loaded modules and rebuilds affected registrations. A failed update cannot leave a partially registered new package; retain the previous valid new-format installation where the installer can do so, otherwise expose a clear failure. This is failure recovery within the new format, not compatibility fallback.

Alternative: infer dependency usage dynamically or mutate shared registries in place. Rejected because both make toggles and failure recovery unreliable.

### 6. Styling and widget vocabulary

`styling.cjs` publishes named token sets, widget variants, and explicitly targeted style overrides. Widget implementation replacement belongs to the widget contribution contract and is never implied by a style entry. Style precedence is host defaults, selected package theme, selected view theme, then explicit node style. Multiple entries within a layer require an explicit ordered selection; filesystem order is irrelevant. Disabling a selected optional style removes its layer; a declared required style dependency makes its consumer unavailable.

Use the design scaffold's complete CSS colors directly, with matching Tailwind/token mappings. Do not wrap full colors in the old `hsl(var(...))` convention. Package IBM Plex Sans/Mono and licenses locally. Translate demo globals into typed production components rather than importing the demo bundle as the application architecture.

The `widget-catalog` spec enumerates the required release vocabulary. Each type has schema, defaults, slots, events, binding rules, theme hooks, keyboard/semantic behavior, and at least one runnable example. Organize delivery into coherent groups: layout/content; forms/interactions; data/collections/media; Eagle-specific widgets. Names inspired by Flutter carry documented web layout semantics rather than pretending to duplicate Flutter's pixel/layout engine. Native dialogs/actions are adapted to Eagle; extension dialogs stay scoped to the stage and do not cover the host source/agent panels.

Alternative: a large list of registered placeholder renderers. Rejected: catalog inclusion requires working behavior, not just recognition of a type name.

### 7. One workbench state and new-format AI versions

The shell owns one selection containing package id, runtime export/screen or contribution/export, and optional conversation/version identity. Source clicks and AI version selection update that same state. The source tree groups built-ins, packages in Power Eagle's scoped Saucepan view, generated packages, and any unscoped artifact staged for the current session. Group acquired packages by Saucepan's canonical source id and source descriptor; no host-owned duplicate package index is required.

Adapt the design's three panels, collapsible rails, independent scrolling, activation inspector, statuses, and single primary Send action. At the existing 910x750 window, use the scaffold's 208px sources and 272px agent proportions and a flexible stage. At smaller widths preserve an operable stage through explicit/minimum-width or rail behavior; do not silently introduce a new mobile shell.

The initial Agent generates/refines canonical runtime JSON against the active registry and schemas. Human authors use the primary TypeScript DSL; both paths validate into the same document model. This avoids adding an unproven compiler/dependency installer to a conversation turn. Custom installed types/actions are supplied to the model as schemas and examples. A proposed new implementation absent from the registry is reported as requiring a separately built provider package.

Persist only new-format conversation records with a format version, immutable successful version payloads, source/base-version identity, and monotonic version allocation. Record generation, validation, and activation failures, including failures before a package is written. Selecting an older version changes the refinement base; new versions never overwrite it. Deleting a turn does not reuse its version number. Legacy conversations are removed by the one-time reset and are neither loaded nor migrated. New generated versions use the same package catalog/activation path and appear under `ai generated`.

Alternative: directly execute generated TS/CJS or retain old ESM conversation execution. Rejected for this change because compiled providers have a separate build contract, while legacy execution is explicitly excluded.

### 8. Retain useful Eagle behavior and release conventions

Re-author File Creator, Recent Libraries, Clipboard, and a widget/style example using the new language and provider contracts. Use the source as behavior evidence, not a command to copy implementation defects (for example, suffix-based library validity). Verify required Eagle operations and reflect actual success/error results; injected bridge adapters keep tests independent from live user data.

Retain the root Eagle manifest's role, `dist/index.html` entry, icon, localization resources, and `.eagleplugin` release convention. Restore or replace only the packaging pieces necessary for that contract; old template-sync/cron automation is not implicitly inherited. Align one chosen package-manager lockfile, remove stale seed scripts and deleted-path aliases, and ensure a clean checkout can build without borrowing source-repo `node_modules` or dist artifacts.

## Risks / Trade-offs

- Embedded Eagle module behavior differs from Node tests -> require the first in-host checkpoint, exact environment evidence, and explicit failure before dependent implementation.
- Unrestricted executable provider code can access Eagle/Node capabilities -> treat installed providers as executable code, not as sandboxed JSON; do not claim export toggles are a security boundary.
- Shared React or module caching is misconfigured -> exercise hook-based widgets, transitive UI dependencies, two dependency versions, and reload/cleanup in the host experiment.
- Native addons and package-manager links reduce portability -> ship self-contained production dependencies and declare supported runtime/platform builds.
- Broad catalog increases scope -> verify complete widget families incrementally; no placeholder types count toward completion.
- Legacy reset targets the wrong location or repeats -> resolve and compare the exact home-relative path, require the new-format sentinel for subsequent launches, and exercise deletion only with disposable storage roots in tests.
- Shell styling leaks into dependency widgets or vice versa -> scope package CSS/assets to the stage and expose explicit SDK style hooks.

## Migration Plan

1. Preserve the reference and design repositories unchanged. Implement only in the revised target and retain unrelated existing edits/deletions.
2. Complete the isolated Eagle loader experiment and record evidence before relying on package-local modules or shared React.
3. Build new schemas/authoring, packages/activation, complete widget groups, host tools, shell, and AI in the checkpoint order in `tasks.md`.
4. Validate the one-time legacy reset, new state sentinel, scoped and unscoped Saucepan paths, fresh conversation storage, and new-format examples with disposable roots.
5. Build and inspect the distributable Eagle plugin, then exercise the packaged application in Eagle. Rollback is reinstalling a previous application release; deleted legacy Power Eagle data is intentionally not recoverable through the new application.
