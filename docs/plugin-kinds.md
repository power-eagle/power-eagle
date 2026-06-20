# Plugin Kinds

> The `definePlugin` contract: every plugin is exactly one of three manifest-gated kinds — visual, service, or styling.

## Purpose

One authoring entry (`definePlugin`) covers three roles, discriminated by
manifest flags rather than separate functions. This keeps the manifest the
single source of truth for what a plugin *is*, and lets the host route
activation by kind.

## Schema

`manifest: { id, name, version, keywords?, service?: boolean, styling?: boolean }`

| Kind | Manifest | Contributes | Must NOT have |
|---|---|---|---|
| **visual** | (no flag) | `view(scope, rt) → Widget` | `provides`, `widgets` |
| **service** | `service: true` | `provides(rt) → object` surface | `view`, `theme`, `widgets` |
| **styling** | `styling: true` | `theme` and/or `widgets` (`type → WidgetComponent`) | `view`, `provides` |

`state` / `derived` / `actions` / `onMount` are available to any kind. A visual
plugin may also carry its own `theme` (its plugin-layer styling in the cascade).

## Constraints

- The kinds are **XOR**: `service` and `styling` cannot both be set
  (`pluginKind` throws). A visual plugin sets neither flag.
- `definePlugin` validates the per-kind invariants **at authoring time** and
  throws immediately — e.g. a styling plugin with a `view`, or a service plugin
  with a `theme`, fails on definition, not at runtime.
- A styling plugin's `widgets` **overload** existing widget types or **insert**
  new ones (the host merges them into the renderer registry); its `theme` feeds
  the theme cascade. It must provide at least one of the two.
- A service surface is resolved by consumers via `rt.service(id)`; a service
  renders no UI.

## Key Invariants

- `activatePlugin` returns exactly the contributions for the kind — `view`
  (visual), `provides` (service), `theme`/`widgets` (styling) — and leaves the
  others `undefined`. The host inspects `pluginKind(manifest)` to wire each.

## Scope Boundary

**Owns:** the plugin definition/classification contract — `definePlugin`,
`pluginKind`, per-kind validation, and the activated contributions.
**Does not own:** how the host *collects and applies* contributions (service
registry threading, widget-registry merge, theme-cascade application) — that is
host orchestration.
