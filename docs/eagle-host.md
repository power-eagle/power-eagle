# Eagle Host Adapter

> Bridges the bundled v3 plugins' typed `EagleHost` contract to the Eagle plugin runtime's injected `eagle` global.

## Purpose

Bundled plugins (file-creator, recent-libraries) call a small typed `EagleHost`
surface (`createFile` / `getRecentLibraries` / `switchLibrary` / `notify`) so
they stay host-agnostic and unit-testable with a fake. This adapter implements
that surface against the real host: `createEagleHost` is pure over injected
primitives, and `defaultEagleHostDeps` wires the real Eagle global.

## Constraints

- The `eagle` global is **injected** into the Eagle plugin renderer (typed in
  `src/eagle.d.ts`). It is always present — reference it directly, never import
  it or "set it up", and do not thread it through layers as if it had to be
  passed in.
- The Node `process` global is **not** reliable in the renderer. Resolve OS
  paths through the Eagle global (`eagle.app.getPath('appData')`), never
  `process.env`. (Regression fixed in commit 5b3cd1f.)
- Eagle exposes **no recent-libraries API**. Recent libraries are the
  `libraryHistory` array inside Eagle's `Settings` file at
  `<appData>/eagle/Settings`, read through the filesystem bridge.
- Eagle's plugin API has **no `library.switch`**. Switching the active library
  is an Eagle *Web API* (HTTP) operation, not a plugin-global call — this adapter
  delegates `switchLibrary` to the Eagle web API client (`docs/eagle-webapi.md`)
  and records the attempt as a host event, swallowing failures.

## Key Invariants

- `getRecentLibraries` locates the settings directory via the Eagle global and
  returns `[]` on any read/parse failure — it must never throw into a plugin
  action.

## Scope Boundary

**Owns:** the `EagleHost` contract implementation over the injected Eagle global
and the filesystem bridge.
**Does not own:** the Eagle Web API client (required for real library
switching), the install/distribution layer, or the widget renderer.
