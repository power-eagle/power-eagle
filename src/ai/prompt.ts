/**
 * Build the model prompt for AI-driven plugin generation. The prompt teaches
 * the model the on-disk plugin contract (a self-contained ESM module that
 * default-exports a definePlugin plugin) and hands it the live service and
 * styling registries so a generated plugin can use what the host already
 * provides. Pure string assembly — no model or filesystem access here.
 */
import type { HostContext } from '../app/host-service';
import { eagleSurface, webApiSurface } from './platform-surface';

/** Which optional platform surfaces to embed in the prompt (both default on). */
export interface PromptOptions {
  includeEagle?: boolean;
  includeWebApi?: boolean;
}

const RULES = `You write a Power Eagle plugin as ONE self-contained ES module that is loaded by dynamic import().
Output ONLY the module source — no prose, no markdown fences, no imports of any kind.
The module MUST inline the definePlugin and w helpers verbatim (shown in the sample) and end with \`export default definePlugin({...})\`.
The default export must be a visual plugin: a manifest plus a view; do not set service/styling flags.

Contract:
- manifest: { id, name, version } — id is a short kebab-case slug, version like "1.0.0".
- state: () => ({...}) — the initial reactive state object.
- actions: { name(rt, ...args) {...} } — invoked from the view via rt.run('name', ...args).
- view: (s, rt) => <widget> — returns the widget tree to render.

Runtime (rt) and scope (s) inside a view/action:
- s.<key> is a reactive accessor — CALL it to read the current value (e.g. s.items()), and pass s.<key> (uncalled) as a widget's value.
- rt.get() returns the whole state; rt.set(draft => { draft.x = ... }) mutates it; rt.run('action', ...args) invokes an action; rt.service('id') returns a registered service's surface.

Widget builder w(type, opts):
- w('col', { children: [...] }) / w('row', { children: [...] }) — vertical / horizontal layout.
- w('text', { data: 'literal or value' }) — text; data may be a string or a value read from state.
- w('input', { value: s.key, placeholder, onInput: (v) => rt.set(d => { d.key = v }) }).
- w('button', { children: 'Label', onPress: () => rt.run('action') }).
- w('list', { for: s.items, empty: w('text', { data: 'none' }), render: (item) => w('text', { key: item(), data: item() }) }) — item is an accessor, call it.`;

const SAMPLE = `Complete valid example — mimic this structure exactly (a todo plugin):

const definePlugin = (def) => ({ manifest: def.manifest, __def: def });
const w = (type, opts = {}) => {
  const props = {}, on = {};
  const structural = new Set(['children', 'for', 'render', 'empty', 'key', 'variant', 'theme', 'when']);
  for (const [k, v] of Object.entries(opts)) {
    if (structural.has(k)) continue;
    if (/^on[A-Z]/.test(k) && typeof v === 'function') { on[k.slice(2).toLowerCase()] = v; continue; }
    props[k] = v;
  }
  const node = { type, props };
  if (opts.children !== undefined) node.children = (Array.isArray(opts.children) ? opts.children : [opts.children]).map((c) => typeof c === 'string' ? { type: 'text', props: { data: c } } : c);
  for (const key of structural) if (opts[key] !== undefined) node[key] = opts[key];
  if (Object.keys(on).length) node.on = on;
  return node;
};

export default definePlugin({
  manifest: { id: 'todo', name: 'Todo', version: '1.0.0' },
  state: () => ({ text: '', items: [] }),
  actions: {
    add(rt) {
      const text = rt.get().text.trim();
      if (!text) return;
      rt.set((d) => { d.items = [...d.items, text]; d.text = ''; });
    },
  },
  view: (s, rt) => w('col', { children: [
    w('text', { data: 'Todo' }),
    w('row', { children: [
      w('input', { value: s.text, placeholder: 'New item', onInput: (v) => rt.set((d) => { d.text = v; }) }),
      w('button', { children: 'Add', onPress: () => rt.run('add') }),
    ] }),
    w('list', { for: s.items, empty: w('text', { data: 'Nothing yet' }), render: (item) => w('text', { key: item(), data: item() }) }),
  ] }),
});`;

/** Render the registered services as a prompt section, or empty when none. */
function servicesSection(context: HostContext): string {
  const lines = Object.entries(context.contributions)
    .filter(([, c]) => c.services)
    .map(([id, c]) => `- ${id}: methods(${c.services!.methods.join(', ')}) vars(${c.services!.vars.join(', ')})`);
  return lines.length ? `Available services (call via rt.service(id)):\n${lines.join('\n')}` : '';
}

/** Render the registered styling widgets/themes as a prompt section, or empty when none. */
function stylingSection(context: HostContext): string {
  const lines = Object.entries(context.contributions)
    .filter(([, c]) => c.widgets || c.theme)
    .map(([id, c]) => `- ${id}: widgets(${(c.widgets ?? []).join(', ')})${c.theme ? ' +theme' : ''}`);
  return lines.length ? `Available styling (widget types you may use):\n${lines.join('\n')}` : '';
}

/** Assemble the full generation prompt from the instruction, registries, and opted-in platform surfaces. */
export function buildGenerationPrompt(instruction: string, context: HostContext, options: PromptOptions = {}): string {
  const { includeEagle = true, includeWebApi = true } = options;
  return [
    'You generate a Power Eagle plugin.',
    RULES,
    SAMPLE,
    includeEagle ? eagleSurface : '',
    includeWebApi ? webApiSurface : '',
    servicesSection(context),
    stylingSection(context),
    `Task: ${instruction}`,
  ]
    .filter((section) => section.length > 0)
    .join('\n\n');
}
