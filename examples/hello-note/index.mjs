// hello-note — example Power Eagle plugin, shipped as a pre-built ESM module.
//
// This is the format an installed plugin ships: manifest.json points `main` at
// this file, and the host's disk loader dynamic-imports it and takes the default
// export. A real plugin would `import { definePlugin, w } from` the Power Eagle
// SDK and let its bundler inline them; for a dependency-free example the two
// helpers are inlined verbatim below (kept in sync with src/sdui).

/** Capture a plugin definition as the { manifest, __def } module the runtime activates. */
const definePlugin = (def) => ({ manifest: def.manifest, __def: def });

/** Build one widget node from a type tag and an options bag (mirror of src/sdui/widget.ts). */
const STRUCTURAL = new Set(['children', 'theme', 'variant', 'when', 'key', 'for', 'render', 'empty']);
const w = (type, opts = {}) => {
  const props = {};
  const on = {};
  for (const [k, v] of Object.entries(opts)) {
    if (STRUCTURAL.has(k)) continue;
    if (/^on[A-Z]/u.test(k) && typeof v === 'function') {
      on[k.slice(2).toLowerCase()] = v;
      continue;
    }
    props[k] = v;
  }
  const node = { type, props };
  if (opts.children !== undefined) {
    const list = Array.isArray(opts.children) ? opts.children : [opts.children];
    node.children = list.map((c) => (typeof c === 'string' ? { type: 'text', props: { data: c } } : c));
  }
  for (const key of ['for', 'render', 'empty', 'key', 'variant', 'theme', 'when']) {
    if (opts[key] !== undefined) node[key] = opts[key];
  }
  if (Object.keys(on).length > 0) node.on = on;
  return node;
};

export default definePlugin({
  manifest: { id: 'hello-note', name: 'Hello Note', version: '1.0.0', keywords: ['example', 'notes'] },
  state: () => ({ name: '', notes: [] }),
  actions: {
    add(rt) {
      const name = rt.get().name.trim();
      if (!name) return;
      rt.set((draft) => {
        draft.notes = [...draft.notes, name];
        draft.name = '';
      });
    },
  },
  view: (s, rt) =>
    w('col', {
      children: [
        w('text', { data: 'Hello Note' }),
        w('row', {
          children: [
            w('input', {
              value: s.name,
              placeholder: 'Note name',
              onInput: (value) => rt.set((draft) => { draft.name = value; }),
            }),
            w('button', { children: 'Add note', onPress: () => rt.run('add') }),
          ],
        }),
        w('list', {
          for: s.notes,
          empty: w('text', { data: 'No notes yet' }),
          render: (item) => w('text', { key: item(), data: item() }),
        }),
      ],
    }),
});
