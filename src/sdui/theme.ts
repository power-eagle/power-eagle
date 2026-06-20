/**
 * Theme resolution: cascade style layers (later wins) then resolve dotted token
 * references against the merged token table. Used by the renderer to compute a
 * widget instance's final style from builtin/user-global/plugin/instance layers.
 */

import type { Theme, Widget } from './types';

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

/** An empty theme (the identity for the cascade). */
export const EMPTY_THEME: Theme = { tokens: {}, widgets: {} };

/** Deep-merge two token tables one level into each category (color, space, …). */
function mergeTokens(
  base: NonNullable<Theme['tokens']>,
  next: NonNullable<Theme['tokens']>,
): NonNullable<Theme['tokens']> {
  const out: Record<string, unknown> = { ...base };
  for (const [category, values] of Object.entries(next)) {
    const current = out[category];
    out[category] =
      current && typeof current === 'object' && values && typeof values === 'object'
        ? { ...(current as object), ...(values as object) }
        : values;
  }
  return out as NonNullable<Theme['tokens']>;
}

/** Cascade whole themes (later wins): tokens deep-merge by category, widget styles merge. */
export function mergeThemes(...themes: Array<Theme | undefined>): Theme {
  const result: Theme = { tokens: {}, widgets: {} };
  for (const theme of themes) {
    if (!theme) continue;
    result.tokens = mergeTokens(result.tokens ?? {}, theme.tokens ?? {});
    for (const [type, widget] of Object.entries(theme.widgets ?? {})) {
      const current = result.widgets![type] ?? {};
      result.widgets![type] = {
        base: mergeStyle(current.base, widget.base),
        variants: { ...current.variants, ...widget.variants },
      };
    }
  }
  return result;
}

/** Resolve one node's final style: widget base, selected variant, then instance theme. */
export function styleForNode(node: Widget, theme: Theme): Style {
  const widget = theme.widgets?.[node.type];
  return resolveStyle(
    [widget?.base, node.variant ? widget?.variants?.[node.variant] : undefined, node.theme],
    (theme.tokens ?? {}) as Record<string, unknown>,
  );
}
