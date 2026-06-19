import { describe, it, expect } from 'vitest';
import { createRegistry } from './registry';

describe('createRegistry', () => {
  it('registers and retrieves by key', () => {
    const r = createRegistry<number>();
    r.register('a', 1);
    expect(r.get('a')).toBe(1);
    expect(r.has('a')).toBe(true);
  });

  it('reports misses and returns undefined for unknown keys', () => {
    const r = createRegistry<number>();
    expect(r.has('missing')).toBe(false);
    expect(r.get('missing')).toBeUndefined();
  });
});
