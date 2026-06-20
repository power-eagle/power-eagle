# Power Eagle

Power Eagle is an [Eagle](https://eagle.cool) plugin that hosts a small SDUI
(server-driven UI) runtime for *extensions*. An extension is a v3 plugin
authored with `definePlugin`; the host activates it and renders its view through
a registry-driven renderer, or runs it in the background to contribute services
and styling.

> This is the **v3** runtime. The older v2 model — a declarative `plugin.json`
> grammar with `ui` node trees and `["namespace", "key", …]` invocation tuples —
> has been removed. Docs or examples mentioning `ui.json`, `main.js`, seed
> generation, or invocation tuples describe a runtime that no longer exists.

## Extension model

Every extension is exactly one of three manifest-gated **kinds**:

| Kind | Manifest flag | Contributes |
|---|---|---|
| **visual** | (none) | a `view` rendered into the host |
| **service** | `service: true` | a `provides` surface other plugins call via `rt.service(id)` |
| **styling** | `styling: true` | a `theme` and/or new/overloaded `widgets` |

The kinds are XOR and validated at authoring time. The formal contract is in
[docs/plugin-kinds.md](docs/plugin-kinds.md); a step-by-step authoring guide for
all three kinds is in [docs/authoring-extensions.md](docs/authoring-extensions.md).

An extension reaches the host either **bundled** (compiled into the app, under
[src/plugins](src/plugins)) or **installed from disk** — a directory with a
`manifest.json` (declaring `id`, `main`, and the kind flags) plus a pre-built
ESM entry whose default export is a `definePlugin` module. The host
dynamic-imports `main` and renders the result.

The smallest installable example is
[examples/hello-note](examples/hello-note) — a visual extension shipped in the
on-disk format.

## Installing extensions

Installation is backed by the [saucepan](https://github.com/ZackaryW/saucepan)
binary, pulled and sha256-verified into `~/.powereagle/bin` on first run. From
the host shell:

- **buckets** tab — register a source by path or `file://` url.
- **install** tab — install by name (`owner/repo` for GitHub sources).
- Installed extensions are grouped by kind under the **app** (visual),
  **service**, and **styling** tabs; **builtin** lists the bundled ones. Each
  has an enable toggle whose state persists across reloads.

Layout under `~/.powereagle`: `bin/` (cached binary), `.saucepan/index.json`
(install index), and `github/<owner--repo>/` · `customgit/<name>/` clone dirs.

> Disk **launch** is currently wired for **visual** extensions. Installed
> service/styling extensions are listed but not yet activated into the shared
> context — only bundled service/styling plugins contribute today.

## Component docs

- [docs/authoring-extensions.md](docs/authoring-extensions.md) — build the three kinds + the on-disk package format
- [docs/plugin-kinds.md](docs/plugin-kinds.md) — the `definePlugin` kind contract and invariants
- [docs/eagle-host.md](docs/eagle-host.md) — the host Eagle bridge
- [docs/eagle-webapi.md](docs/eagle-webapi.md) — the Eagle Web API client
- [docs/fs-bridge.md](docs/fs-bridge.md) — the renderer filesystem bridge

## Development

```bash
pnpm install      # install dependencies
pnpm dev          # run the dev shell
pnpm build        # typecheck + production build (dist/)
pnpm test         # run the vitest suite (unit + vitest-cucumber BDD)
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint
```

Power Eagle itself ships as an Eagle plugin: the repository-root `manifest.json`
is the Eagle host manifest (it points Eagle at `dist/index.html`), and
[.github/workflows/eagle-plugin-pkg.yml](.github/workflows/eagle-plugin-pkg.yml)
packages a release from it.

## Contributing

- Author extensions with `definePlugin` + `w`; keep each to a single kind.
- Behavior is specified by BDD features under [features/](features) and driven
  fail-first; component rationale lives in [docs/](docs).
- Do not reintroduce the v2 declarative grammar (`ui.json`, invocation tuples,
  seed generation).
