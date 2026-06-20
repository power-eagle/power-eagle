import { describe, it, expect } from 'vitest';
import * as nodeFs from 'node:fs';
import * as nodePath from 'node:path';
import * as nodeOs from 'node:os';
import { loadTheme } from './theme-store';

(globalThis as unknown as { window: { require: (m: string) => unknown } }).window = {
  require: (moduleName: string) => {
    if (moduleName === 'fs') return nodeFs;
    if (moduleName === 'path') return nodePath;
    if (moduleName === 'os') return nodeOs;
    throw new Error(`Unexpected module request: ${moduleName}`);
  },
};

function freshRoot(): string {
  return nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'pe-theme-'));
}

describe('loadTheme', () => {
  it('returns an empty theme when no theme.json exists', () => {
    expect(loadTheme(freshRoot())).toEqual({ tokens: {}, widgets: {} });
  });

  it('loads and parses a theme.json from the root', () => {
    const root = freshRoot();
    const theme = { tokens: { color: { brand: '#0066ff' } }, widgets: { button: { base: { background: 'color.brand' } } } };
    nodeFs.writeFileSync(nodePath.join(root, 'theme.json'), JSON.stringify(theme));
    expect(loadTheme(root)).toEqual(theme);
  });

  it('falls back to an empty theme on invalid json', () => {
    const root = freshRoot();
    nodeFs.writeFileSync(nodePath.join(root, 'theme.json'), '{ not json');
    expect(loadTheme(root)).toEqual({ tokens: {}, widgets: {} });
  });
});
