import { describe, it, expect } from 'vitest';
import { listBuiltins, getBuiltin } from './builtins';

describe('builtin plugin catalog', () => {
  it('lists the bundled plugins with their manifests', () => {
    const ids = listBuiltins().map((manifest) => manifest.id);
    expect(ids).toContain('file-creator');
    expect(ids).toContain('recent-libraries');
  });

  it('resolves a bundled plugin module by id', () => {
    expect(getBuiltin('file-creator')?.manifest.name).toBe('File Creator');
  });

  it('returns undefined for an unknown id', () => {
    expect(getBuiltin('does-not-exist')).toBeUndefined();
  });
});
