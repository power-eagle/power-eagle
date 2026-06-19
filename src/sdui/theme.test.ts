import { describe, it, expect } from 'vitest';
import { resolveStyle } from './theme';

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
