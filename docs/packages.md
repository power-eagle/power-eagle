# Package acquisition and contribution contract

Power Eagle uses Saucepan 0.6's shared central store. It does not download a private executable, create `saucepan.toml`, maintain buckets, read the encrypted index, or reconstruct a content path. Install or build a compatible Saucepan executable independently at `~/.saucepan/bin/saucepan[.exe]`, or configure an explicit executable path. Initialize the user store deliberately once with:

```sh
saucepan init
```

Acquisition never initializes a missing store. Power Eagle calls the executable asynchronously through Eagle's Node 16 bridge with literal arguments and temporary JSON files. The executable owns provider behavior, encryption, credentials, locking, content verification, snapshots, and its index. A missing executable or unavailable store disables package controls while built-in runtimes remain available.

## Clean Power Eagle state

The first revised launch removes the complete legacy Power Eagle-owned `~/.powereagle` tree and obsolete browser enablement keys. This deliberately deletes old conversations, themes, cached Saucepan binaries, workspace configuration/indexes, managed clones, and generated package data inside that root. There is no migration or compatibility fallback.

The reset never deletes a local source outside `~/.powereagle` and never deletes the shared `~/.saucepan` store. After cleanup, Power Eagle recreates its root with a versioned sentinel. Later launches retain the new state only when that sentinel is valid; an unreadable or unknown sentinel fails startup rather than risking another deletion.

```text
~/.powereagle/
  .power-eagle-state.json       # power-eagle/state version 1 sentinel
  .saucepanhash                 # stable Power Eagle Saucepan app token

~/.saucepan/
  bin/saucepan[.exe]            # independently installed shared executable
  index.json.enc                # owned exclusively by Saucepan
  index.lock
  sources/<source-id>/...       # shared central content and snapshots
```

Power Eagle writes neither `index.json.enc` nor a companion installed-package index. Its durable package list is the marker-scoped Saucepan view.

## Recipes and persistence

Acquisition accepts the current Git, URL, and local recipe shapes. The local runtime example is checked in at [`examples/saucepan-recipes/local-runtime.json`](../examples/saucepan-recipes/local-runtime.json):

```json
{"source":{"provider":"local","path":"examples/runtime-only"}}
```

Git can track a ref or pin a full commit:

```json
{
  "source": {
    "provider": "git",
    "origin": "https://github.com/example/power-eagle-packages.git",
    "reference": "main"
  },
  "folder": "packages/example"
}
```

URL recipes declare whether the result is one named file or a ZIP:

```json
{
  "source": {
    "provider": "url",
    "url": "https://example.com/power-eagle-package.zip",
    "download": {"format":"zip"}
  }
}
```

Local inputs are copied into Saucepan's central store. Power Eagle validates and loads the `directory` returned by acquisition; it never assumes that the original local path is the installed package.

Persistent acquisition registers the `power-eagle` app once, stores its stable marker under the clean state root, and uses that marker for acquire, view, path, history, snapshot, mirror, configure, and verify. Successfully validated artifacts return through the scoped view after restart.

Session-only acquisition omits app, marker, and authoritative flags. It shares Saucepan's verified retained content but creates no Power Eagle touch. Power Eagle keeps a validated session artifact only in memory and labels it session-only; it does not return after restart. Use this path for preview or validation, not installation.

Artifacts are grouped by Saucepan's canonical `source_id` and full `source` descriptor. Two Git origins remain separate even though both use the `git` provider. Package discovery uses only Saucepan-returned directories and static files. It does not execute provider code.

## Acquisition validation and recovery

Every acquired directory must pass the new manifest, runtime, entry, asset, SDK, host-target, and path-containment checks before Power Eagle publishes it. When `package.json` declares production dependencies, discovery resolves and version-checks them from inside that acquired directory without evaluating provider modules. Power Eagle never builds acquired source or runs a package manager.

A persistent package occupies a canonical source-and-folder slot. If a newly acquired or refreshed artifact fails validation, the error names the failing layer and the previously validated package in that slot remains active. Transport success alone never publishes partial package state.

| Failure layer | Meaning | Recovery |
| --- | --- | --- |
| state reset | target or sentinel is unsafe/invalid | inspect the exact `~/.powereagle` path; do not bypass the guard |
| tooling launch | shared executable is missing or cannot start | install Saucepan 0.6 or configure its exact executable path |
| central store | initialization, credentials, locking, source, or policy failed | run explicit setup when needed and follow Saucepan's stderr diagnostic |
| transport/protocol | process terminated or returned non-JSON/incompatible output | use a compatible Saucepan 0.6 executable and retry |
| package format | manifest/runtime/entry/asset path is invalid or legacy | publish a `power-eagle/package` version 1 artifact |
| dependency | a declared production dependency is absent, external, or has the wrong version | rebuild the artifact with its complete production `node_modules` |
| host compatibility | SDK, platform, architecture, or Node target excludes Eagle | rebuild for the recorded Eagle runtime or correct the manifest target |

Raw Saucepan stderr remains attached to command failures. Package diagnostics remain distinct from acquisition failures, so repairing a manifest does not masquerade as a network or credential problem.

`manifest.json` uses `format: "power-eagle/package"` and `formatVersion: 1`. Required metadata is `id`, `name`, full semantic `version`, `description`, and supported host `sdk` range. IDs use letters followed by letters, digits, dots, underscores, or hyphens. An export is identified as `package.id/exportId`.

## Mix contributions

`contributions` can declare any combination of `runtime`, `widgets`, `styling`, `actions`, and `services`. At least one contribution and one matching export are required. Entries are declared paths; conventional names are `run.json`, `types.cjs`, `styling.cjs`, `actions.cjs`, and `services.cjs`. Runtime entries must end in `.json`; executable entries must end in `.cjs`. A provider-only package needs no runtime entry.

Every contribution must have matching descriptors in `exports`. Export IDs are unique across all kinds in the package:

| Export kind | Static descriptor |
| --- | --- |
| `runtime` | `id`, nonempty `screens` list |
| `widget` | `id`, `contract` with `properties`, `defaults`, `slots`, `events`, `themeHooks`, `example`, optional `parents` |
| `styling` | `id`, token object schema `tokens`, qualified widget `targets` |
| `action` | `id`, `contract` with `input`/`output` schemas |
| `service` | `id`, named `methods`, each with `input`/`output` schemas |

Use the schema vocabulary in [language.md](language.md). Widget examples name their qualified export. Static discovery reads these fields and validates every declared entry, asset, and runtime screen without evaluating executable modules. `discoverContributionPackage` returns canonical package-owned paths and rejects missing files or paths that resolve outside the package.

Compiled entries export one factory function. Loading injects a package-anchored `require`, host shared modules, and an asset URL resolver. The factory returns one contribution with its full descriptors beside its implementations:

```js
module.exports = sdk => ({
  format: 'power-eagle/provider',
  formatVersion: 1,
  kind: 'widget',
  exports: [{
    descriptor: widgetDescriptor,
    implementation: widgetImplementation,
  }],
});
```

The loader publishes nothing unless every provider export matches the manifest's kind, id, and descriptor exactly. Undeclared, duplicate, omitted, or schema-divergent exports fail the package. A missing private npm dependency identifies the owning package contribution instead of affecting unrelated packages. Kind-specific authoring factories are described below.

Discovery resolves every declared entry and asset from the canonical package root. Lexical traversal, absolute paths, missing files, and symlink or junction escapes fail before provider code runs. `assetUrl` accepts only a declared asset key and returns a URL for its current installed location, so relocating a complete artifact does not retain an authoring-path reference.

When provider code changes, `reloadCompiledContributions` removes cached modules only when their canonical files belong to that package, then reloads its entries. Package-local dependency instances are replaced with the provider while modules owned by other installed packages remain cached.

## Qualified dependency graph

Every export enters the registry as `package.id/exportId`. Package-manifest dependencies apply to each export in that package; dependencies declared by `run.json` apply to its runtime exports. Resolution verifies the required identity, export kind, and package semantic-version range before making a consumer available.

The graph calculates a stable dependency-first activation order by qualified identity, independent of source discovery order. A duplicate identity is an error for every colliding candidate and never selects a winner. Missing exports, ambiguous identities, wrong kinds, incompatible versions, and cycles fail only the affected branch; unrelated exports remain in the available registry. A dependent of a failed branch reports the unavailable identity rather than appearing valid.

Each export also records sorted, distinct package identities that directly declare it. This includes consumers whose own status is failed, because `used by` describes the declared graph rather than observed calls or current activation.

Enablement intent is stored separately in the versioned `power-eagle/enablement` version `1` record. Missing package or export keys default to enabled. Package preferences and qualified export preferences remain independent: disabling a package suppresses all its exports without rewriting individual choices, so those choices return unchanged after a reload and package re-enable. Browser persistence uses the separate `power-eagle.enablement.v1` storage key.

Reconciliation computes effective status from current intent and the dependency graph. A disabled package or export is `off`; a desired export with a structural or dependency problem is `failed` with the exact cause; a desired valid export whose required exports are active is `active`. If a required export becomes off, enabled consumers fail with that qualified dependency identity. Re-enabling a valid dependency recovers them in the existing dependency order without changing saved preferences. An explicitly off consumer stays off even when its dependencies fail.

Provider definitions may include an `activate` hook beside the descriptor and implementation. The hook receives a provider-lifetime abort signal, a `use` method for owned disposers, and dependency service lookup. Exports compiled from one contribution entry form one activation group: their hooks complete before the group becomes visible, and any hook failure revokes staged services and disposes all resources prepared by that group. Other groups continue activating.

Reconciliation revokes affected service slots before removing their registrations and disposes active exports in reverse dependency order. A service handle belongs to one activation; calls through a handle obtained before disable or replacement fail after revocation, even if the same service is later re-enabled. Repeated toggles create one fresh scope and service slot per activation.

Provider scopes are separate from runtime view scopes. Service methods receive the calling view's signal and `use` callback, so view replacement releases resources created for that view. The provider scope and unrelated service handles remain active until enablement, reload, or application shutdown removes the provider itself.

## Activation walkthrough

Suppose `dashboard/main` calls `clock/clock`. The dashboard runtime declares the public dependency in `run.json`:

```json
{
  "package": "clock",
  "version": "^1.0.0",
  "export": "clock",
  "kind": "service"
}
```

With both packages enabled, the graph places `clock/clock` before `dashboard/main`. The service reports `used by 1` with `dashboard` as its direct consuming package; the runtime itself is `unused` unless another package declares it. Calling the service does not change these counts.

Disabling the service writes user intent independently of graph status:

```json
{
  "format": "power-eagle/enablement",
  "formatVersion": 1,
  "packages": {},
  "exports": {
    "clock/clock": false
  }
}
```

After reconciliation, `clock/clock` is `off` and `dashboard/main` is `failed` with cause `dependency-off: clock/clock`. Reopening the workbench reads the same preference. Re-enabling the service leaves the dashboard's preference untouched, activates the service first, and then recovers the dashboard.

Reloading changed provider code replaces the affected activation group. Active dependents are disposed before the old provider; its handles are revoked; the new provider activates before its enabled dependents return. A failed replacement publishes none of that group's staged registrations and disposes resources prepared during the attempt. Unrelated package registrations and dependency instances stay active.

The executable scenarios in [`features/contribution-activation.feature`](../features/contribution-activation.feature) cover dependency order and cycle isolation, persisted toggles, revocation and recovery, view/provider lifetimes, activation rollback, changed registrations, declared usage, and deterministic styling.

## Styling composition

Active styling exports form a catalog separate from widget implementations. A styling export can contribute token values, named variants, and overrides only for the qualified widget targets declared by its manifest descriptor. Loading or selecting a style never registers or replaces a widget renderer. An override for an undeclared target is invalid.

The host composes a widget's effective values in this order:

1. host tokens and host widget style;
2. selected package themes;
3. selected view themes;
4. the node's explicit style.

Every selected package or view theme carries an integer `order`. Values in the same layer apply from lower to higher order, and duplicate orders are rejected, so discovery and filesystem order cannot affect the result. A selected variant applies after that export's targeted override. Later values replace earlier keys; unrelated keys remain in the composed result.

When an optional selection is disabled or unavailable, its layer is absent and lower-layer values become effective. A required styling export is declared as a normal qualified `styling` dependency. Disabling it makes its consumer `failed` with a `dependency-off` cause; attempting to compose a required selection that is absent also produces a `required-style-unavailable` error.

## Provider SDK factories

Provider source imports the public authoring entry that the package compiler supplies:

```ts
import {
  defineWidgetProvider,
  type ProviderWidgetRenderProps,
} from '@power-eagle/sdk';
```

The entry exports `defineWidgetProvider`, `defineActionProvider`, `defineServiceProvider`, and `defineStylingProvider`. `npm run language:types` emits their declarations to `.artifacts/sdk-types/sdk`; `tsconfig.package-examples.json` shows the repository mapping used to typecheck local package sources. The package compiler resolves `@power-eagle/sdk` into the compiled provider, so the installed artifact does not require the authoring SDK package. Each factory accepts static definitions or a callback that receives the package-scoped SDK:

- widget implementations provide a React renderer for resolved properties, slots, styles, and events;
- action implementations provide one typed asynchronous invoker;
- service implementations provide named method invokers;
- styling implementations provide serializable token, variant, and targeted-override maps.

The SDK supplies `packageId`, `packageRoot`, package-anchored `require`, declared `assetUrl`, and host-owned `react`, `react-dom`, and `react/jsx-runtime` modules. Compiled providers must use those shared modules; shipping another React instance into the stage is outside the contract. The production loader refuses to start providers when the required shared modules are absent.

`dependencies` is an explicit array of `{package, version, export, kind}` requirements. Ranges follow npm semantic version syntax. Duplicate dependencies on the same qualified identity are invalid. Runtime validation checks the supplied available-export catalog for matching kind/version and requires a widget/call reference to declare its dependency. npm dependencies remain private and do not become public exports.

`assets` is the array of shipped relative asset paths. Optional `target` declares nonempty `platform` (`win32`, `darwin`, `linux`) and `arch` (`x64`, `arm64`) arrays plus a Node `node` version range. Declaring a target is not proof of host support. Discovery compares all declared target dimensions with the actual host before loading code and reports each incompatible platform, architecture, or Node range. File existence and canonical filesystem containment are enforced at the same boundary.

## Compiled target status

The provider build compiles TS/TSX to CommonJS for Chrome 108 and Node 16.17, bundles ordinary imports (including ESM-only libraries), maps React/ReactDOM/JSX imports to the host, and ships explicitly external production dependencies in a package-local `node_modules`. A build configuration selects the manifest, provider sources, and dependencies that must remain external:

```json
{
  "format": "power-eagle/build",
  "formatVersion": 1,
  "manifest": "manifest.json",
  "providers": {
    "widgets": "src/types.tsx",
    "styling": "src/styling.ts",
    "actions": "src/actions.ts",
    "services": "src/services.ts"
  },
  "externalDependencies": ["some-private-library"]
}
```

Every provider source is optional and must correspond to the matching manifest contribution. Dependencies in `externalDependencies` must also appear in the source package's production `dependencies`; the builder resolves them from the source package and copies their production trees without package-manager links. Omit an imported library from this list to bundle it into the compiled provider, which is the normal choice for ESM-only libraries. React, ReactDOM, and JSX runtime imports always remain host supplied.

An import such as `clsx` listed in `externalDependencies` is required at run time from the artifact's own `node_modules`. Imports omitted from that list are compiled into each provider entry. UI dependencies should normally be bundled so their React imports pass through the provider's host-runtime mapping. Assets are copied only when declared in `manifest.json`; provider code obtains them with `sdk.assetUrl('assets/name.ext')`, while runtime JSON uses `{ "$asset": "assets/name.ext" }`.

Build a staged, validated artifact with:

```sh
npm run package:build -- path/to/power-eagle.build.json path/to/output
```

The output contains only the normalized manifest, declared runtime documents and assets, compiled `.cjs` providers, package metadata, and copied production dependencies. It does not contain the provider TypeScript, build configuration, workspace symlinks, or an install script. `package.json` records the exact copied dependency versions plus the manifest SDK and platform target. The resulting directory can be relocated and loaded without the author's checkout, package cache, TypeScript compiler, or a runtime dependency installation.

The isolated experiment is available via `npm run fixture:check`. It has a deliberately minimal experimental manifest and is not a public SDK example. The approach passed in Eagle 4.0.0 on Windows x64 as recorded in [provider-host-validation.md](provider-host-validation.md), and the production manifest-first loader now uses that verified boundary. The currently verified compiled target is Eagle's Windows x64 runtime with Node 16.17.1. Packages that declare a different platform, architecture, or Node range are rejected before their native or JavaScript entry executes.

| Contract | Verified value |
| --- | --- |
| Host SDK | `1.0.0` (`manifest.sdk: ^1.0.0`) |
| Eagle | `4.0.0` build `23` |
| Electron / Chrome | `22.3.7` / `108.0.5359.215` |
| Node / module ABI | `16.17.1` / `110` |
| Platform / architecture | Windows `win32` / `x64` |
| Provider output | CommonJS `.cjs`, Chrome 108 and Node 16.17 syntax target |

Other operating systems, architectures, Node ranges, and native-addon builds are not implied by this result. Declare the exact supported `target`; discovery reports incompatible dimensions before provider execution.

## Provider-only and mixed examples

`examples/provider-only` contains only a widget contribution. Its hook-using toggle imports `@power-eagle/sdk`, uses host React, loads `clsx` from its artifact-local `node_modules`, and resolves a declared SVG through `sdk.assetUrl`.

`examples/mixed-package` combines `run.json`, a hook-using widget provider, a styling provider, the same kind of private dependency, and a separate declared asset. The runtime declares and renders its package's own widget export. Each source directory retains `manifest.json`, `package.json`, `power-eagle.build.json`, provider sources, and assets; compiled outputs preserve the installed layout rather than the authoring tree.

Build and typecheck both examples from the repository root:

```sh
npm run package:examples
```

The outputs are `.artifacts/package-examples/provider-only` and `.artifacts/package-examples/mixed-package`. To build either package independently:

```sh
npm run package:build -- examples/provider-only/power-eagle.build.json .artifacts/provider-only
npm run package:build -- examples/mixed-package/power-eagle.build.json .artifacts/mixed-package
```

The normal production contract is exercised with:

```sh
npx vitest run src/host/install/package-examples.test.tsx
```

That check builds clean artifacts, discovers their manifests without running code, validates the recorded Eagle target, loads through the package-anchored CommonJS loader, renders both widgets through runtime documents, clicks their hook-driven controls, resolves their relocated assets, verifies separate private dependency instances, and loads the mixed styling export.

## Runtime-only example

`examples/runtime-only` contains `document.ts`, `manifest.json`, and generated canonical `run.json`. Run:

```sh
npm run language -- example
npm run language -- validate examples/runtime-only/manifest.json
npm run language -- validate examples/runtime-only/run.json
```

The typed source is unnecessary once compiled. The same static validator accepts its Saucepan-returned directory; workbench acquisition controls and final release packaging are later checkpoints.

The same manifest-first layout is used by `examples/layout-widgets`, `examples/content-widgets`, `examples/control-widgets`, and `examples/collection-feedback-media`. The control package is the public Section 7 acceptance example; the collection/feedback/media package is the Section 8 acceptance example. Their typed sources reference every widget in their checkpoints, while each generated `run.json` is the only runtime payload an installed package needs.

## Source organization

Implementation stays under `src/app`, `src/sdui`, `src/host/install`, `src/plugins`, `src/ai`, and `src/components/ui`. Host installation code owns only the CLI transport, Power Eagle marker, acquisition result validation, and in-memory publication. Saucepan owns the shared executable location and central storage. Old Power Eagle payloads and storage records are deleted by the reset rather than converted or retained.
