import { afterAll, describe, expect, it } from 'vitest';
import { cpSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToString } from 'react-dom/server';
import { createProbeLoader } from './provider-probe';

const testRoot = realpathSync(mkdtempSync(join(tmpdir(), 'power-eagle-provider-')));
cpSync(resolve('.artifacts/provider-host/packages'), join(testRoot, 'packages'), { recursive: true });
const hostRequire = createRequire(import.meta.url);
const loader = createProbeLoader(hostRequire);
const shared = { react: React, 'react-dom': ReactDOM, 'react/jsx-runtime': jsxRuntime };
const alpha = join(testRoot, 'packages/alpha');
const beta = join(testRoot, 'packages/beta');
afterAll(() => {
  loader.clear(alpha); loader.clear(beta);
  const parent = realpathSync(tmpdir());
  const rel = relative(parent, realpathSync(testRoot));
  if (!rel.startsWith('power-eagle-provider-') || rel.includes(sep)) throw new Error('Unexpected cleanup directory');
  rmSync(testRoot, { recursive: true, force: true });
});

describe('compiled provider experiment (Node evidence only)', () => {
  it('loads relocated packages with isolated private versions and shared React', () => {
    const first = loader.load(alpha, shared, () => {});
    const second = loader.load(beta, shared, () => {});
    expect([first.dependencyVersion, second.dependencyVersion]).toEqual(['1.2.1', '2.1.1']);
    expect(first.dependencyPath.startsWith(alpha + sep)).toBe(true);
    expect(second.dependencyPath.startsWith(beta + sep)).toBe(true);
    expect(first.shared).toEqual({ react: true, reactDom: true, jsx: true });
    expect(renderToString(React.createElement(first.Widget))).toContain('role="switch"');
  });
  it('rejects paths outside the package', () => {
    expect(() => loader.resolveFile(alpha, '../beta/manifest.json')).toThrow('escapes');
  });
  it('reloads changed code while preserving an unrelated private dependency instance', () => {
    const betaRequire = createRequire(join(beta, 'package.json'));
    const before = betaRequire('clsx');
    writeFileSync(join(alpha, 'types.cjs'), readFileSync(join(alpha, 'types.next.cjs')));
    loader.clear(alpha);
    expect(loader.load(alpha, shared, () => {}).revision).toBe('updated');
    expect(betaRequire('clsx')).toBe(before);
  });
});
