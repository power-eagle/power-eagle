import { describe, it, expect } from 'vitest';
import { classifyRepo, parseManifest, parseMarketplace } from './parse';

describe('classifyRepo', () => {
  it('classifies a repo by its root manifests', () => {
    expect(classifyRepo(['manifest.json', 'README.md'])).toEqual({ isPlugin: true, isMarketplace: false });
    expect(classifyRepo(['marketplace.json'])).toEqual({ isPlugin: false, isMarketplace: true });
    expect(classifyRepo(['manifest.json', 'marketplace.json'])).toEqual({ isPlugin: true, isMarketplace: true });
  });

  it('rejects a repo with neither manifest', () => {
    expect(() => classifyRepo(['README.md'])).toThrow(/manifest\.json or marketplace\.json/);
  });
});

describe('parseManifest', () => {
  it('parses a valid plugin manifest', () => {
    const m = parseManifest({ id: 'x', name: 'X', version: '1.0.0', engine: 'peagle-sdui@3', main: 'index.js' });
    expect(m.id).toBe('x');
    expect(m.main).toBe('index.js');
  });

  it('throws on a missing required field', () => {
    expect(() => parseManifest({ name: 'X', version: '1.0.0' })).toThrow(/id/);
  });
});

describe('parseMarketplace', () => {
  it('parses entries with local and git sources', () => {
    const mk = parseMarketplace({
      name: 'mk',
      plugins: [
        { name: 'a', source: { type: 'local', path: './plugins/a' } },
        { name: 'b', source: { type: 'git', url: 'https://example.com/y' } },
      ],
    });
    expect(mk.plugins).toHaveLength(2);
    expect(mk.plugins[0].source).toEqual({ type: 'local', path: './plugins/a' });
    expect(mk.plugins[1].source).toEqual({ type: 'git', url: 'https://example.com/y', ref: undefined });
  });

  it('throws when plugins is missing', () => {
    expect(() => parseMarketplace({ name: 'mk' })).toThrow(/plugins/);
  });
});
