import { describe, it, expect } from 'vitest';
import { createWidgetRegistry } from './render';
describe('render smoke', () => {
  it('registry has builtins', () => {
    const r = createWidgetRegistry();
    expect(r.has('text')).toBe(true);
    expect(r.has('button')).toBe(true);
  });
});
