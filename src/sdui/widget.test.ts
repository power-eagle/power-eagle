import { describe, it, expect } from 'vitest';
import { w } from './widget';

describe('w() builder', () => {
  it('positional type does not collide with a type prop', () => {
    const node = w('input', { type: 'password', placeholder: 'x' });
    expect(node.type).toBe('input');
    expect(node.props).toEqual({ type: 'password', placeholder: 'x' });
  });

  it('lifts structural keys off props and maps on* handlers to events', () => {
    const fn = () => undefined;
    const node = w('button', { children: 'Go', variant: 'primary', onPress: fn });
    expect(node.variant).toBe('primary');
    expect(node.children).toEqual([{ type: 'text', props: { data: 'Go' } }]);
    expect(node.on?.press).toBe(fn);
    expect(node.props).toEqual({});
  });

  it('normalizes a children array, converting bare strings to text nodes', () => {
    const child = w('badge', { label: 'x' });
    const node = w('row', { children: ['hi', child] });
    expect(node.children).toEqual([{ type: 'text', props: { data: 'hi' } }, child]);
  });
});
