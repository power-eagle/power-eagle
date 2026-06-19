/**
 * Theme resolution: cascade style layers (later wins) then resolve dotted token
 * references against the merged token table. Used by the renderer to compute a
 * widget instance's final style from builtin/user-global/plugin/instance layers.
 */

/** A flat style map of token refs or literal values. */
export type Style = Record<string, string | number>;

/** Shallow-merge style layers; later layers override earlier keys. */
export function mergeStyle(...layers: Array<Style | undefined>): Style {
  return Object.assign({}, ...layers.filter(Boolean));
}

/** Resolve a dotted path (e.g. "color.primary") against a token tree. */
function lookup(tokens: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((node, key) => {
    if (node && typeof node === 'object' && key in (node as Record<string, unknown>)) {
      return (node as Record<string, unknown>)[key];
    }
    return undefined;
  }, tokens);
}

/** A value is a token ref if it's a dotted string that resolves to a primitive. */
function resolveValue(value: string | number, tokens: Record<string, unknown>): string | number {
  if (typeof value !== 'string' || !value.includes('.')) {
    return value;
  }
  const resolved = lookup(tokens, value);
  return typeof resolved === 'string' || typeof resolved === 'number' ? resolved : value;
}

/** Replace token refs in a style with their resolved values. */
export function resolveRefs(style: Style, tokens: Record<string, unknown>): Style {
  const out: Style = {};
  for (const [k, v] of Object.entries(style)) {
    out[k] = resolveValue(v, tokens);
  }
  return out;
}

/** Cascade style layers and resolve token refs in one step. */
export function resolveStyle(layers: Array<Style | undefined>, tokens: Record<string, unknown>): Style {
  return resolveRefs(mergeStyle(...layers), tokens);
}
