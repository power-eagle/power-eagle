# New-format package contract

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

## Provider SDK factories

The typed SDK entry under `src/sdui/sdk` exports `defineWidgetProvider`, `defineActionProvider`, `defineServiceProvider`, and `defineStylingProvider`. `npm run language:types` emits their public declarations. Each factory accepts static definitions or a callback that receives the package-scoped SDK:

- widget implementations provide a React renderer for resolved properties, slots, styles, and events;
- action implementations provide one typed asynchronous invoker;
- service implementations provide named method invokers;
- styling implementations provide serializable token, variant, and targeted-override maps.

The SDK supplies `packageId`, `packageRoot`, package-anchored `require`, declared `assetUrl`, and host-owned `react`, `react-dom`, and `react/jsx-runtime` modules. Compiled providers must use those shared modules; shipping another React instance into the stage is outside the contract. The production loader refuses to start providers when the required shared modules are absent.

`dependencies` is an explicit array of `{package, version, export, kind}` requirements. Ranges follow npm semantic version syntax. Duplicate dependencies on the same qualified identity are invalid. Runtime validation checks the supplied available-export catalog for matching kind/version and requires a widget/call reference to declare its dependency. npm dependencies remain private and do not become public exports.

`assets` is the array of shipped relative asset paths. Optional `target` declares nonempty `platform` (`win32`, `darwin`, `linux`) and `arch` (`x64`, `arm64`) arrays plus a Node `node` version range. Declaring a target is not proof of host support. Runtime compatibility, file existence, and canonical filesystem containment are enforced at the later package-build/loading boundary.

## Compiled target status

The candidate provider build compiles TS/TSX to CommonJS, bundles transitive UI code, maps React/ReactDOM/JSX imports to the host, and ships remaining production dependencies in a package-local `node_modules`. It must not need the author's checkout, package cache, or runtime dependency installation.

The isolated experiment is available via `npm run fixture:check`. It has a deliberately minimal experimental manifest and is not a public SDK example. The approach passed in Eagle 4.0.0 on Windows x64 as recorded in [provider-host-validation.md](provider-host-validation.md), and the production manifest-first loader now uses that verified boundary. Native addons, ESM-only libraries, and other platform/runtime combinations remain subject to later compatibility and build checks.

## Runtime-only example

`examples/runtime-only` contains `document.ts`, `manifest.json`, and generated canonical `run.json`. Run:

```sh
npm run language -- example
npm run language -- validate examples/runtime-only/manifest.json
npm run language -- validate examples/runtime-only/run.json
```

The typed source is unnecessary once compiled. Production installation and release packaging are later checkpoints; the runtime-only example loads through the foundation validator and runtime renderer.

## Retained organization

Implementation stays under `src/app`, `src/sdui`, `src/host/install`, `src/plugins`, `src/ai`, and `src/components/ui`. The intended installed layout remains `~/.powereagle/bin`, `saucepan.toml`, `.saucepan/index.json`, Saucepan-reported package paths, local packages in place, and `conversations/<id>/v<N>`. This checkpoint does not touch those stores. Old payloads are unsupported and are not converted or overwritten.
