import { describe, it, expect } from 'vitest';
import { listBuiltins, getBuiltin } from './builtins';
import { pluginKind } from '../sdui/activate';

describe('builtin plugin catalog', () => {
  it('lists the bundled plugins of every kind with their manifests', () => {
    const ids = listBuiltins().map((manifest) => manifest.id);
    expect(ids).toContain('file-creator');
    expect(ids).toContain('recent-libraries');
    expect(ids).toContain('clipboard');
    expect(ids).toContain('extras');
  });

  it('bundles a service and a styling plugin', () => {
    expect(pluginKind(getBuiltin('clipboard')!.manifest)).toBe('service');
    expect(pluginKind(getBuiltin('extras')!.manifest)).toBe('styling');
  });

  it('resolves a bundled plugin module by id', () => {
    expect(getBuiltin('file-creator')?.manifest.name).toBe('File Creator');
  });

  it('returns undefined for an unknown id', () => {
    expect(getBuiltin('does-not-exist')).toBeUndefined();
  });
});
