import { describe, it, expect } from 'vitest';
import { resolveStyle, mergeThemes, styleForNode } from './theme';
import type { Theme, Widget } from './types';

describe('mergeThemes', () => {
  it('cascades tokens and per-widget styles, later themes winning', () => {
    const builtin: Theme = { tokens: { color: { primary: '#111' } }, widgets: { button: { base: { padding: 4 } } } };
    const global: Theme = {
      tokens: { color: { primary: '#06f', accent: '#0f0' } },
      widgets: { button: { base: { background: 'color.primary' } } },
    };
    const merged = mergeThemes(builtin, global);
    expect(merged.tokens?.color).toEqual({ primary: '#06f', accent: '#0f0' });
    expect(merged.widgets?.button.base).toEqual({ padding: 4, background: 'color.primary' });
  });
});

describe('styleForNode', () => {
  const theme: Theme = {
    tokens: { color: { primary: '#06f', danger: '#f00' } },
    widgets: {
      button: {
        base: { background: 'color.primary', padding: 6 },
        variants: { danger: { background: 'color.danger' } },
      },
    },
  };

  it('resolves a widget base style against the theme tokens', () => {
    const node: Widget = { type: 'button', props: {} };
    expect(styleForNode(node, theme)).toEqual({ background: '#06f', padding: 6 });
  });

  it('applies the selected variant over the base style', () => {
    const node: Widget = { type: 'button', props: {}, variant: 'danger' };
    expect(styleForNode(node, theme)).toEqual({ background: '#f00', padding: 6 });
  });

  it('lets a per-instance theme override the variant and base', () => {
    const node: Widget = { type: 'button', props: {}, variant: 'danger', theme: { background: '#fff' } };
    expect(styleForNode(node, theme)).toEqual({ background: '#fff', padding: 6 });
  });

  it('returns an empty style for a widget the theme does not mention', () => {
    expect(styleForNode({ type: 'mystery', props: {} }, theme)).toEqual({});
  });
});

describe('theme cascade', () => {
  const tokens = { color: { primary: '#111', danger: '#f00' } };

  it('cascades layers (later wins) and resolves token refs', () => {
    const builtin = { background: 'color.primary', padding: 4 };
    const plugin = { background: 'color.danger' }; // plugin overrides builtin
    const instance = { color: '#fff' }; // literal, not a token ref
    const style = resolveStyle([builtin, plugin, instance], tokens);
    expect(style).toEqual({ background: '#f00', padding: 4, color: '#fff' });
  });

  it('leaves an unresolved ref as its literal string', () => {
    const style = resolveStyle([{ color: 'color.missing' }], tokens);
    expect(style.color).toBe('color.missing');
  });
});
