/**
 * `w(type, opts)` — the single uniform widget builder.
 *
 * The widget tag is the positional `type`, so a widget-specific prop named
 * `type` (e.g. an input's) never collides. Structural keys are lifted onto the
 * node; `on<Event>` handlers become `on.<event>`; everything else is a prop.
 */
import type { Widget } from './types';

/** Keys that are structural node fields, not widget props. */
const STRUCTURAL = new Set(['children', 'theme', 'variant', 'when', 'key']);

/** Build one uniform widget node from a type tag and an options bag. */
export function w(type: string, opts: Record<string, unknown> = {}): Widget {
  const props: Record<string, unknown> = {};
  const on: Record<string, (...args: unknown[]) => unknown> = {};

  for (const [k, v] of Object.entries(opts)) {
    if (STRUCTURAL.has(k)) {
      continue;
    }
    if (/^on[A-Z]/.test(k) && typeof v === 'function') {
      on[k.slice(2).toLowerCase()] = v as (...args: unknown[]) => unknown;
      continue;
    }
    props[k] = v;
  }

  const node: Widget = { type, props };
  if (opts.children !== undefined) {
    node.children = normalizeChildren(opts.children);
  }
  if (opts.theme) {
    node.theme = opts.theme as Widget['theme'];
  }
  if (opts.variant) {
    node.variant = opts.variant as string;
  }
  if (opts.when) {
    node.when = opts.when as Widget['when'];
  }
  if (opts.key) {
    node.key = opts.key as Widget['key'];
  }
  if (Object.keys(on).length > 0) {
    node.on = on;
  }
  return node;
}

/** Coerce children into Widget[]: bare strings become text nodes. */
function normalizeChildren(children: unknown): Widget[] {
  if (typeof children === 'string') {
    return [textNode(children)];
  }
  if (Array.isArray(children)) {
    return children.map((c) => (typeof c === 'string' ? textNode(c) : (c as Widget)));
  }
  return [children as Widget];
}

/** A `text` widget wrapping a literal string. */
function textNode(data: string): Widget {
  return { type: 'text', props: { data } };
}
