# Authoring Power Eagle Extensions

> How to build and ship the three kinds of Power Eagle extension for the v3 (SDUI) runtime.

An extension is a v3 plugin authored with `definePlugin`. Every extension is
exactly one of three manifest-gated **kinds** — visual, service, or styling
(the formal contract and per-kind invariants live in
[plugin-kinds.md](plugin-kinds.md)). An extension reaches the host in one of two
ways:

- **Bundled built-in** — compiled into the app (see `src/plugins`); always
  available, and built-in service/styling plugins contribute to the shared
  runtime context.
- **Installed from disk** — pulled by the saucepan-backed installer into
  `~/.powereagle` and loaded at runtime. This is the format below.

## The on-disk package

An installed extension is a directory containing a `manifest.json` and a
pre-built ESM entry:

```
my-extension/
  manifest.json
  index.mjs        # the built ESM entry named by manifest.main
```

`manifest.json`:

```json
{
  "name": "Hello Note",
  "version": "1.0.0",
  "description": "Add named notes to a list.",
  "id": "hello-note",
  "main": "index.mjs",
  "service": false,
  "styling": false
}
```

- `name` / `version` / `description` are the saucepan package fields.
- `id`, `main`, and the `service` / `styling` kind flags are Power Eagle's. The
  flags let the host classify the extension (and place it in the right tab)
  before loading any code; they must match the module's own manifest.
- `main` points at a **pre-built ESM** file. The host dynamic-imports it and
  takes its **default export**, which must be a `definePlugin` module. The app
  is already an ES module context, so ship built ESM — no runtime compiler runs.

> Do not confuse this with the repository-root `manifest.json`, which is the
> *Eagle host plugin* manifest for Power Eagle itself — a different schema.

The smallest working example is [../examples/hello-note](../examples/hello-note)
(a visual extension); the smoke test in
[../src/host/install/disk-plugin.smoke.test.ts](../src/host/install/disk-plugin.smoke.test.ts)
loads it exactly as the host does.

## Visual extension — renders a view

A visual extension sets no kind flag and provides a `view`:

```js
import { definePlugin, w } from 'powereagle'; // your bundler inlines these

export default definePlugin({
  manifest: { id: 'hello-note', name: 'Hello Note', version: '1.0.0' },
  state: () => ({ name: '', notes: [] }),
  actions: {
    add(rt) {
      const name = rt.get().name.trim();
      if (!name) return;
      rt.set((draft) => { draft.notes = [...draft.notes, name]; draft.name = ''; });
    },
  },
  view: (s, rt) =>
    w('col', {
      children: [
        w('text', { data: 'Hello Note' }),
        w('input', { value: s.name, placeholder: 'Note name', onInput: (v) => rt.set((d) => { d.name = v; }) }),
        w('button', { children: 'Add note', onPress: () => rt.run('add') }),
        w('list', { for: s.notes, empty: w('text', { data: 'No notes yet' }), render: (item) => w('text', { key: item(), data: item() }) }),
      ],
    }),
});
```

## Service extension — provides methods/objects

A service extension sets `service: true`, renders no UI, and exposes a surface
through `provides`. Consumers reach it with `rt.service(id)`:

```js
export default definePlugin({
  manifest: { id: 'clipboard', name: 'Clipboard', version: '1.0.0', service: true },
  provides: (rt) => ({
    copy: (text) => rt.eagle.clipboard.writeText(text),
    read: () => rt.eagle.clipboard.readText(),
  }),
});
```

```js
// in another plugin's action:
const clip = rt.service('clipboard');
await clip.copy('hello');
```

## Styling extension — theme and/or widgets

A styling extension sets `styling: true` and contributes a `theme` and/or a
`widgets` map (new widget types, or overloads of existing ones). It must provide
at least one:

```js
export default definePlugin({
  manifest: { id: 'neon', name: 'Neon', version: '1.0.0', styling: true },
  theme: { tokens: { color: { brand: '#39ff14' } }, widgets: { button: { base: { background: 'color.brand' } } } },
  widgets: { badge: (props) => /* a WidgetComponent */ null },
});
```

## State, actions, and the runtime bridge

Available to any kind via `definePlugin`:

- `state: () => S` — initial state; `derived` — computed views over state.
- `actions: { name(rt, ...args) }` — invoked with `rt.run('name', ...args)`.
- In a `view(scope, rt)`: `scope.<key>` is a reactive accessor (call it to read);
  `rt.get()` reads state, `rt.set((draft) => …)` mutates it.
- `rt.eagle` is the host Eagle bridge; `rt.service(id)` resolves another
  service's surface.

## Installing an extension

Use the shell's install tabs (backed by the saucepan binary, pulled and
sha256-verified into `~/.powereagle/bin` on first run):

- **buckets** tab — register a source by path or `file://` url.
- **install** tab — install by name (`owner/repo` for GitHub sources).
- Installed extensions appear under **app** (visual), **service**, or
  **styling** by kind; **builtin** lists the bundled ones. Each row has an
  enable toggle whose state persists across reloads.

Install layout under `~/.powereagle`:

- `bin/` — the cached saucepan binary.
- `.saucepan/index.json` — the installed-extension index.
- `github/<owner--repo>/`, `customgit/<name>/` — cloned packages; `local`
  sources stay in place.

## Current limitation

Disk **launch** is wired for **visual** extensions: opening an installed visual
extension resolves its path (`saucepan <root> path <name>`), imports `main`, and
renders it. Installed **service** and **styling** extensions are listed and show
their overview, but are **not yet activated into the shared runtime context** —
only bundled built-in service/styling plugins contribute today. Wiring installed
service/styling into the context is a known follow-up.
